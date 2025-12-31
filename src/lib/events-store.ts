
'use client';

import { db } from './firebase';
import {
    collection,
    doc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    query,
    where,
    onSnapshot,
    Timestamp,
    getDocs,
    limit,
    orderBy,
    getDoc
} from 'firebase/firestore';
import type { Event, EventVote, PrizeDrawResult, AuthUser } from './types';

// === Event Management (Owner only) ===

/**
 * Subscribes to all events, regardless of status. For admin use.
 */
export function subscribeToAllEvents(callback: (events: Event[]) => void): () => void {
    const q = query(
        collection(db, 'events'),
        orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const events = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as Event));
        callback(events);
    }, (error) => {
        console.error("Error subscribing to all events:", error);
        callback([]);
    });

    return unsubscribe;
}


/**
 * Creates a new event or updates an existing one.
 */
export async function addOrUpdateEvent(event: Omit<Event, 'id'>, id?: string): Promise<string> {
    const docRef = id ? doc(db, 'events', id) : doc(collection(db, 'events'));
    
    const dataToSave = {
        ...event,
        updatedAt: serverTimestamp()
    };
    if (!id) {
        (dataToSave as any).createdAt = serverTimestamp();
    }
    
    await setDoc(docRef, dataToSave, { merge: true });
    return docRef.id;
}

/**
 * Deletes an event and all its associated votes and draws.
 */
export async function deleteEvent(eventId: string): Promise<void> {
    const eventRef = doc(db, 'events', eventId);
    
    // Delete votes subcollection
    const votesQuery = query(collection(db, `events/${eventId}/votes`));
    const votesSnapshot = await getDocs(votesQuery);
    const voteDeletes = votesSnapshot.docs.map(voteDoc => deleteDoc(voteDoc.ref));
    await Promise.all(voteDeletes);

    // Delete draws subcollection
    const drawsQuery = query(collection(db, `events/${eventId}/draws`));
    const drawsSnapshot = await getDocs(drawsQuery);
    const drawDeletes = drawsSnapshot.docs.map(drawDoc => deleteDoc(drawDoc.ref));
    await Promise.all(drawDeletes);

    await deleteDoc(eventRef);
}

// === Event Interaction (For Users) ===

/**
 * Subscribes to active events that are relevant to the current user's role.
 */
export function subscribeToActiveEvents(userRole: string, callback: (events: Event[]) => void): () => void {
    const q = query(
        collection(db, 'events'),
        where('status', '==', 'active'),
        // where('eligibleRoles', 'array-contains', userRole), // This line is commented out to show all active events for now.
        where('endAt', '>', Timestamp.now())
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const events = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as Event)).filter(event => event.eligibleRoles.length === 0 || event.eligibleRoles.includes(userRole as any));
        callback(events);
    }, (error) => {
        console.error("Error subscribing to active events:", error);
        callback([]);
    });

    return unsubscribe;
}

/**
 * Submits a user's vote for a given event.
 * Now accepts votes, ratings, and comments.
 */
export async function submitVote(eventId: string, voteData: Omit<EventVote, 'id' | 'createdAt'>): Promise<void> {
    // The vote document ID is the user's ID to enforce one vote per user.
    const voteRef = doc(db, `events/${eventId}/votes`, voteData.userId);
    
    await setDoc(voteRef, {
        ...voteData,
        createdAt: serverTimestamp(),
    }, { merge: true });
}


/**
 * Fetches a user's existing vote for an event, if any.
 */
export async function getUserVote(eventId: string, userId: string): Promise<EventVote | null> {
    const voteRef = doc(db, `events/${eventId}/votes`, userId);
    const voteSnap = await getDoc(voteRef);

    if (voteSnap.exists()) {
        return { id: voteSnap.id, ...voteSnap.data() } as EventVote;
    }
    return null;
}

// === Prize Draw Functions (Owner only) ===

/**
 * Runs a prize draw for a ballot-type event.
 */
export async function runPrizeDraw(eventId: string, winnerCount: number, owner: AuthUser): Promise<string[]> {
    const votesQuery = query(collection(db, `events/${eventId}/votes`));
    const votesSnapshot = await getDocs(votesQuery);
    
    if (votesSnapshot.empty) {
        throw new Error("No entries to draw from.");
    }

    const entries = votesSnapshot.docs.map(doc => ({
        userId: doc.id,
        userName: doc.data().userDisplay?.name || 'Unknown User'
    }));

    // Simple random draw
    const shuffled = entries.sort(() => 0.5 - Math.random());
    const winners = shuffled.slice(0, winnerCount);

    // Save the draw result
    const drawResult: Omit<PrizeDrawResult, 'id'> = {
        eventId,
        drawnAt: serverTimestamp() as Timestamp,
        winners: winners,
    };
    await addDoc(collection(db, `events/${eventId}/draws`), drawResult);
    
    return winners.map(w => w.userName);
}

export async function getEventVotes(eventId: string): Promise<EventVote[]> {
    const votesQuery = query(collection(db, `events/${eventId}/votes`));
    const votesSnapshot = await getDocs(votesQuery);
    
    return votesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as EventVote));
}

export async function getEventDraws(eventId: string): Promise<PrizeDrawResult[]> {
    const drawsQuery = query(collection(db, `events/${eventId}/draws`), orderBy('drawnAt', 'desc'));
    const drawsSnapshot = await getDocs(drawsQuery);
    
    return drawsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as PrizeDrawResult));
}
