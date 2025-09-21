/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/document";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {onCall, onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {getMessaging} from "firebase-admin/messaging";

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

export const helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

export const sendTestNotification = onCall(async (request) => {
  const userId = request.data.userId;

  if (!userId || typeof userId !== "string") {
    logger.error("Missing or invalid 'userId' in request data.");
    throw new onCall.HttpsError("invalid-argument", "The function must be called with a 'userId' argument.");
  }

  try {
    logger.info(`Attempting to send notification to user: ${userId}`);

    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      logger.error(`User document not found for userId: ${userId}`);
      throw new onCall.HttpsError("not-found", "User not found.");
    }

    const fcmToken = userDoc.data()?.fcmToken;
    if (!fcmToken) {
      logger.warn(`FCM token not found for user: ${userId}`);
       throw new onCall.HttpsError("not-found", "FCM token for user not found.");
    }

    logger.info(`Found FCM token: ${fcmToken}`);

    const message = {
      notification: {
        title: "Chào mừng đến với Katrina One!",
        body: `Xin chào ${userDoc.data()?.displayName || 'bạn'}, hệ thống thông báo đã sẵn sàng!`,
      },
      token: fcmToken,
    };

    const response = await messaging.send(message);
    logger.info("Successfully sent message:", response);

    return { success: true, message: `Message sent successfully to user ${userId}` };
  } catch (error) {
    logger.error("Error sending message:", error);
    if (error instanceof onCall.HttpsError) {
        throw error;
    }
    throw new onCall.HttpsError("internal", "Error sending message");
  }
});
