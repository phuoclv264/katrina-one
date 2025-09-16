
'use server';
/**
 * @fileOverview A flow to automatically expire pending pass requests.
 * This flow queries for all 'pending' pass requests and checks if the shift start time has passed.
 * If it has, the request status is updated to 'cancelled'.
 * This flow is intended to be run on a schedule (e.g., every hour) by a server process like a cron job or a scheduled Cloud Function.
 *
 * - expirePassRequests - A function that triggers the expiration process.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { collection, query, where, getDocs, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Notification, PassRequestPayload } from '@/lib/types';

const ExpirePassRequestsOutputSchema = z.object({
  expiredCount: z.number().describe('The number of pass requests that were expired.'),
  checkedCount: z.number().describe('The total number of pending requests that were checked.'),
});
export type ExpirePassRequestsOutput = z.infer<typeof ExpirePassRequestsOutputSchema>;

export async function expirePassRequests(): Promise<ExpirePassRequestsOutput> {
  return expirePassRequestsFlow();
}

const expirePassRequestsFlow = ai.defineFlow(
  {
    name: 'expirePassRequestsFlow',
    inputSchema: z.void(),
    outputSchema: ExpirePassRequestsOutputSchema,
  },
  async () => {
    console.log('Running job to expire old pass requests...');
    const now = new Date();
    const notificationsCollection = collection(db, 'notifications');
    
    // Query for all pending pass requests
    const q = query(
        notificationsCollection, 
        where('type', '==', 'pass_request'), 
        where('status', '==', 'pending')
    );

    const querySnapshot = await getDocs(q);
    const pendingRequests = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
    
    let expiredCount = 0;
    const batch = writeBatch(db);

    for (const request of pendingRequests) {
        const payload = request.payload as PassRequestPayload;
        try {
            // Combine date and time to create a full shift start Date object
            const shiftStartTimeString = `${payload.shiftDate}T${payload.shiftTimeSlot.start}:00`;
            const shiftStartDate = new Date(shiftStartTimeString);

            // If the shift start time has already passed
            if (now > shiftStartDate) {
                console.log(`Expiring pass request ${request.id} for shift at ${shiftStartDate.toLocaleString()}`);
                const notificationRef = doc(db, 'notifications', request.id);
                batch.update(notificationRef, {
                    status: 'cancelled',
                    'payload.cancellationReason': 'Tự động hết hạn do đã quá giờ làm việc.'
                });
                expiredCount++;
            }
        } catch (error) {
            console.error(`Error processing request ${request.id}:`, error);
        }
    }

    if (expiredCount > 0) {
        await batch.commit();
        console.log(`Successfully expired ${expiredCount} pass requests.`);
    } else {
        console.log('No pass requests needed to be expired.');
    }

    return {
        expiredCount,
        checkedCount: pendingRequests.length,
    };
  }
);
