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
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { photoStore } from './photo-store';
import { v4 as uuidv4 } from 'uuid';
import type { WhistleblowingReport, ReportComment } from './types';


// Helper function to upload attachments
const uploadAttachments = async (reportId: string, photoIds: string[]): Promise<string[]> => {
    if (photoIds.length === 0) return [];
    
    const uploadPromises = photoIds.map(async (photoId) => {
        const photoBlob = await photoStore.getPhoto(photoId);
        if (!photoBlob) return null;
        const storageRef = ref(storage, `whistleblowing/${reportId}/${uuidv4()}`);
        await uploadBytes(storageRef, photoBlob);
        return getDownloadURL(storageRef);
    });

    const urls = (await Promise.all(uploadPromises)).filter((url): url is string => !!url);
    await photoStore.deletePhotos(photoIds);
    return urls;
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
        data: Omit<WhistleblowingReport, 'id' | 'createdAt' | 'updatedAt' | 'upvotes' | 'downvotes' | 'attachments' | 'accusedUsers' | 'isPinned'> & { attachmentIds: string[], accusedUsers: {id: string, name: string}[] },
    ): Promise<string> {
        const { attachmentIds, ...reportData } = data;
        const newReportRef = doc(collection(db, 'reports-feed'));
        const reportId = newReportRef.id;

        const attachmentUrls = await uploadAttachments(reportId, attachmentIds);

        const newReport: Omit<WhistleblowingReport, 'id'> = {
            ...reportData,
            attachments: attachmentUrls,
            isPinned: false, // Default to not pinned
            upvotes: [],
            downvotes: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            commentCount: 0,
            anonymousNameMap: {},
        };
        
        if (!newReport.reporterId) {
            throw new Error("Reporter information is missing.");
        }
        
        await setDoc(newReportRef, newReport);
        return reportId;
    },

    async deleteReport(reportId: string): Promise<void> {
        // Note: Implement logic to delete associated attachments from Storage if needed.
        await deleteDoc(doc(db, 'reports-feed', reportId));
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

    async addComment(reportId: string, commentData: Omit<ReportComment, 'id' | 'createdAt' | 'photos'>, photoIds: string[]): Promise<void> {
        const reportRef = doc(db, 'reports-feed', reportId);
        
        const attachmentUrls = await uploadAttachments(`${reportId}/comments`, photoIds);

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
                photos: attachmentUrls,
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
        
        await photoStore.deletePhotos(photoIds);
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
            updatedComments[commentIndex].text = newContent;

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
            
            if (commentToDelete?.photos) {
                await Promise.all(commentToDelete.photos.map(url => deleteObject(ref(storage, url))));
            }
            
            const updatedComments = existingComments.filter(c => c.id !== commentId);
            transaction.update(reportRef, { 
                comments: updatedComments,
                commentCount: (existingReport.commentCount || 1) - 1
            });
        });
    },
};
