'use client';

import { db, storage } from './firebase';
import {
    collection,
    doc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    query,
    orderBy,
    onSnapshot,
    arrayUnion,
    arrayRemove,
    runTransaction,
    getDoc,
    Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, getMetadata } from 'firebase/storage';
import { photoStore } from './photo-store'; 
import { v4 as uuidv4 } from 'uuid';
import type { WhistleblowingReport, ReportComment, ManagedUser, AssignedUser, Attachment, MediaAttachment, CommentMedia } from './types';
import { uploadMedia } from './data-store-helpers';


// Helper function to upload attachments
const uploadAttachments = async (reportId: string, localAttachments: {id: string, file: File}[]): Promise<Attachment[]> => {
    if (localAttachments.length === 0) return [];
    
    const uploadPromises = localAttachments.map(async (att) => {
        const photoBlob = await photoStore.getPhoto(att.id);
        if (!photoBlob) return null;
        const storageRef = ref(storage, `whistleblowing/${reportId}/${uuidv4()}_${att.file.name}`);
        const metadata = { contentType: att.file.type };
        await uploadBytes(storageRef, photoBlob, metadata);
        const url = await getDownloadURL(storageRef);
        return { url, name: att.file.name, type: att.file.type };
    });

    const results = (await Promise.all(uploadPromises)).filter((url): url is Attachment => !!url);
    await photoStore.deletePhotos(localAttachments.map(att => att.id));
    return results;
};

// Main data store object
export const reportsStore = {
    // --- Whistleblowing Reports ---

    subscribeToReports(callback: (reports: WhistleblowingReport[]) => void): () => void {
        const q = query(collection(db, 'reports-feed'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const reports = snapshot.docs.map(doc => {
                 const data = doc.data();
                 return {
                    id: doc.id,
                    ...data,
                    createdAt: (data.createdAt as any)?.toDate()?.toISOString() || new Date().toISOString(),
                    updatedAt: (data.updatedAt as any)?.toDate()?.toISOString() || new Date().toISOString(),
                 } as WhistleblowingReport
            });
            callback(reports);
        }, (error) => {
            console.error("Error subscribing to reports:", error);
            callback([]);
        });
        return unsubscribe;
    },

    async createReport(
        data: Omit<WhistleblowingReport, 'id' | 'createdAt' | 'updatedAt' | 'upvotes' | 'downvotes' | 'attachments' | 'accusedUsers' | 'isPinned'> & { localAttachments: {id: string, file: File}[], accusedUsers: ManagedUser[] },
    ): Promise<string> {
        const { localAttachments, ...reportData } = data;
        const newReportRef = doc(collection(db, 'reports-feed'));
        const reportId = newReportRef.id;

        const attachmentUrls = await uploadAttachments(reportId, localAttachments);

        const newReport: Omit<WhistleblowingReport, 'id'> = {
            ...reportData,
            attachments: attachmentUrls,
            isPinned: false, // Default to not pinned
            upvotes: [],
            downvotes: [],
            createdAt: serverTimestamp() as Timestamp,
            updatedAt: serverTimestamp() as Timestamp,
            commentCount: 0,
            anonymousNameMap: {},
        };
        
        if (!newReport.reporterId) {
            throw new Error("Reporter information is missing.");
        }
        
        await setDoc(newReportRef, newReport);
        return reportId;
    },
    
    async updateReport(
        reportId: string,
        data: Omit<WhistleblowingReport, 'id' | 'createdAt' | 'updatedAt' | 'upvotes' | 'downvotes' | 'reporterId' | 'isPinned' | 'attachments' | 'commentCount' | 'anonymousNameMap'> & { localAttachments?: {id: string, file: File}[], existingAttachments?: Attachment[] }
    ): Promise<void> {
        const { localAttachments, existingAttachments, ...reportData } = data;
        const reportRef = doc(db, 'reports-feed', reportId);
        
        const newAttachmentUrls = await uploadAttachments(reportId, localAttachments || []);
        
        const updatedReportData: Partial<WhistleblowingReport> = {
            ...reportData,
            attachments: [...(existingAttachments || []), ...newAttachmentUrls],
            updatedAt: serverTimestamp() as Timestamp,
        };

        await updateDoc(reportRef, updatedReportData);
    },

    async deleteReport(reportId: string): Promise<void> {
        const reportRef = doc(db, 'reports-feed', reportId);
        const reportSnap = await getDoc(reportRef);
        if (reportSnap.exists()) {
            const reportData = reportSnap.data() as WhistleblowingReport;
            const allAttachments = [...(reportData.attachments || []), ...(reportData.comments || []).flatMap(c => c.photos || [])];
            const deletePromises = allAttachments.map(att => {
                if(typeof att === 'string') { // handle old string format
                     return deleteObject(ref(storage, att)).catch(err => console.error(`Failed to delete old attachment ${att}:`, err));
                }
                 return deleteObject(ref(storage, att.url)).catch(err => console.error(`Failed to delete attachment ${att.name}:`, err));
            });
            await Promise.all(deletePromises);
        }

        await deleteDoc(reportRef);
    },
    
    async togglePin(reportId: string, currentPinStatus: boolean): Promise<void> {
        const reportRef = doc(db, 'reports-feed', reportId);
        await updateDoc(reportRef, {
            isPinned: !currentPinStatus,
            updatedAt: serverTimestamp(),
        });
    },

    async vote(reportId: string, userId: string, voteType: 'up' | 'down'): Promise<void> {
        const reportRef = doc(db, 'reports-feed', reportId);
        await runTransaction(db, async (transaction) => {
            const reportDoc = await transaction.get(reportRef);
            if (!reportDoc.exists()) {
                throw "Report does not exist.";
            }

            const data = reportDoc.data() as WhistleblowingReport;
            const upvotes = data.upvotes || [];
            const downvotes = data.downvotes || [];

            const oppositeField = voteType === 'up' ? 'downvotes' : 'upvotes';
            const targetField = voteType === 'up' ? 'upvotes' : 'downvotes';
            
            const hasVoted = upvotes.includes(userId) || downvotes.includes(userId);
            const currentVoteList = voteType === 'up' ? upvotes : downvotes;
            const isUnvoting = hasVoted && currentVoteList.includes(userId);
            
            if (hasVoted) {
                 transaction.update(reportRef, {
                    upvotes: arrayRemove(userId),
                    downvotes: arrayRemove(userId)
                });
            }

            if (!isUnvoting) {
                 transaction.update(reportRef, { [targetField]: arrayUnion(userId) });
            }
        });
    },

    // --- Comments ---

    async addComment(reportId: string, commentData: Omit<ReportComment, 'id' | 'createdAt' | 'photos'>, medias: CommentMedia[]): Promise<void> {
        const reportRef = doc(db, 'reports-feed', reportId);
        
        const newAttachments = await uploadMedia(medias.map((m) => {return {id: m.id, type: m.type}}), `${reportId}/comments`);

        await runTransaction(db, async (transaction) => {
            const reportDoc = await transaction.get(reportRef);
            if (!reportDoc.exists()) throw "Report not found.";
            
            const reportData = reportDoc.data() as WhistleblowingReport;
            let anonymousNameMap = reportData.anonymousNameMap || {};

            // If the comment is anonymous and the user doesn't have a name in this report's map yet, create one.
            if (commentData.isAnonymous && !anonymousNameMap[commentData.authorId]) {
                const existingNames = new Set(Object.values(anonymousNameMap));
                let newName = '';
                do {
                    newName = `Người dùng #${Math.floor(Math.random() * 9000) + 1000}`;
                } while (existingNames.has(newName));
                anonymousNameMap[commentData.authorId] = newName;
            }
            
            const newComment: ReportComment = {
                ...commentData,
                id: uuidv4(),
                media: newAttachments,
                createdAt: new Date().toISOString(),
            };

            const currentCommentCount = reportData.commentCount || 0;
            const updatedData: Partial<WhistleblowingReport> = {
                comments: arrayUnion(newComment) as any,
                commentCount: currentCommentCount + 1,
                anonymousNameMap: anonymousNameMap, // Always update the map
            };
            
            transaction.update(reportRef, updatedData);
        });
        
        await photoStore.deletePhotos(medias.map(m => m.id));
    },

    async editComment(reportId: string, commentId: string, newContent: string): Promise<void> {
        const reportRef = doc(db, 'reports-feed', reportId);
        await runTransaction(db, async (transaction) => {
            const reportDoc = await transaction.get(reportRef);
            if (!reportDoc.exists()) {
                throw new Error("Report not found.");
            }
            const violation = reportDoc.data() as WhistleblowingReport;
            const comments = violation.comments || [];
            const commentIndex = comments.findIndex(c => c.id === commentId);

            if (commentIndex === -1) {
                throw new Error("Comment not found.");
            }
            
            const updatedComments = [...comments];
            updatedComments[commentIndex].content = newContent;

            transaction.update(reportRef, { comments: updatedComments });
        });
    },

    async deleteComment(reportId: string, commentId: string): Promise<void> {
        const reportRef = doc(db, 'reports-feed', reportId);
        await runTransaction(db, async (transaction) => {
            const reportDoc = await transaction.get(reportRef);
            if (!reportDoc.exists()) throw "Report not found.";

            const existingReport = reportDoc.data() as WhistleblowingReport;
            const existingComments: ReportComment[] = existingReport.comments || [];
            const commentToDelete = existingComments.find(c => c.id === commentId);
            
            if (commentToDelete?.media) {
                await Promise.all(commentToDelete.media.map(att => deleteObject(ref(storage, att.url))));
            }
            
            const updatedComments = existingComments.filter(c => c.id !== commentId);
            transaction.update(reportRef, { 
                comments: updatedComments,
                commentCount: (existingReport.commentCount || 1) - 1
            });
        });
    },
};
