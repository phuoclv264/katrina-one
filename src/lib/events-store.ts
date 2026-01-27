
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
function normalizeEventDoc(id: string, raw: any): Event {
    // Ensure UI-code never receives undefined for commonly accessed fields.
    // Keep timestamps as-is (Firestore Timestamp-like) so existing helpers (toDateSafe) work.
    const type: Event['type'] = raw?.type || 'vote';

    const base: Event = {
        id,
        title: raw?.title || '',
        description: raw?.description || '',
        type,
        status: raw?.status || 'draft',
        startAt: raw?.startAt ?? Timestamp.now(),
        endAt: raw?.endAt ?? Timestamp.now(),
        createdAt: raw?.createdAt ?? Timestamp.now(),
        updatedAt: raw?.updatedAt ?? Timestamp.now(),
        ownerId: raw?.ownerId || raw?.createdBy || '',
        eligibleRoles: raw?.eligibleRoles ?? [],
        candidates: raw?.candidates ?? [],
        options: raw?.options ?? [],
        allowComments: raw?.allowComments ?? true,
        anonymousResults: raw?.anonymousResults ?? false,
        // Test-only flag
        isTest: Boolean(raw?.isTest),
        // keep other optional fields from raw when present
        // type-specific defaults applied below
    } as any;

    // Type-specific defaults
    if (type === 'multi-vote') {
        base.maxVotesPerUser = typeof raw?.maxVotesPerUser === 'number' ? raw.maxVotesPerUser : (raw?.maxVotesPerUser ? Number(raw.maxVotesPerUser) : 1);
    } else {
        // explicitly undefined for non-multi-vote to avoid accidental usage
        delete (base as any).maxVotesPerUser;
    }

    if (type === 'ballot') {
        base.prize = raw?.prize ?? raw?.reward ?? undefined;
    } else {
        delete (base as any).prize;
    }

    return base;
}

export function subscribeToAllEvents(callback: (events: Event[]) => void): () => void {
    const q = query(
        collection(db, 'events'),
        orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const events = snapshot.docs.map(doc => normalizeEventDoc(doc.id, doc.data()));
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
    
    // Apply safe defaults before persisting to avoid undefined fields in Firestore.
    // Build a fully-specified document and deeply sanitize nested objects so
    // nothing `undefined` is written to Firestore (Firestore rejects `undefined`).
    const sanitizeCandidate = (c: any) => ({
        id: String(c?.id ?? ''),
        name: String(c?.name ?? ''),
        avatarUrl: c?.avatarUrl ?? null,
        meta: c?.meta ? Object.fromEntries(Object.entries(c.meta).map(([k, v]) => [k, v === undefined ? null : v])) : null,
    });

    const sanitizeOption = (o: any) => ({
        id: String(o?.id ?? ''),
        name: String(o?.name ?? ''),
    });

    const dataToSaveRaw: Record<string, any> = {
        // core
        title: String(event.title || ''),
        description: String(event.description || ''),
        type: event.type || 'vote',
        status: event.status ?? 'draft',
        ownerId: String(event.ownerId || ''),

        // timestamps
        startAt: event.startAt ?? serverTimestamp(),
        endAt: event.endAt ?? serverTimestamp(),

        // eligibility & content
        eligibleRoles: (event.eligibleRoles || []).filter(Boolean),
        candidates: (event.candidates || []).map(sanitizeCandidate),
        options: (event.options || []).map(sanitizeOption),

        // interaction flags
        allowComments: Boolean(event.allowComments ?? true),
        anonymousResults: Boolean(event.anonymousResults ?? false),

        // bookkeeping
        updatedAt: serverTimestamp(),
    };

    // Type-specific persisted shape (explicit null for non-applicable fields)
    dataToSaveRaw.maxVotesPerUser = event.type === 'multi-vote'
        ? (typeof event.maxVotesPerUser === 'number' ? event.maxVotesPerUser : 1)
        : null;

    dataToSaveRaw.prize = event.type === 'ballot'
        ? {
            name: String(event.prize?.name ?? ''),
            description: String(event.prize?.description ?? ''),
            imageUrl: event.prize?.imageUrl ?? null,
        }
        : null;

    // Test-only marker
    dataToSaveRaw.isTest = Boolean(event.isTest);

    if (!id) {
        (dataToSaveRaw as any).createdAt = serverTimestamp();
    }

    // Defensive final pass: convert any remaining `undefined` (shallow) to null
    for (const [k, v] of Object.entries(dataToSaveRaw)) {
        if (v === undefined) dataToSaveRaw[k] = null;
    }

    await setDoc(docRef, dataToSaveRaw, { merge: true });
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
export function subscribeToActiveEvents(userRole: string, isTestUser: boolean = false, callback?: (events: Event[]) => void): () => void {
    const q = query(
        collection(db, 'events'),
        where('status', '==', 'active'),
        // where('eligibleRoles', 'array-contains', userRole), // This line is commented out to show all active events for now.
        where('endAt', '>', Timestamp.now())
    );

    const cb = callback || (() => {});
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const events = snapshot.docs
            .map(doc => normalizeEventDoc(doc.id, doc.data()))
            .filter(event => (event.eligibleRoles || []).length === 0 || (event.eligibleRoles || []).includes(userRole as any))
            .filter(event => {
                // hide test events from non-test users
                if (event.isTest) return Boolean(isTestUser);
                return true;
            });
        cb(events);
    }, (error) => {
        console.error("Error subscribing to active events:", error);
        cb([]);
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

/**
 * Deletes a specific user's vote document for an event.
 * Useful for admins/owners to remove invalid or inappropriate votes.
 */
export async function deleteVote(eventId: string, userId: string): Promise<void> {
    const voteRef = doc(db, `events/${eventId}/votes`, userId);
    await deleteDoc(voteRef);
}
