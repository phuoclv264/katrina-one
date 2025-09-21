/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/document";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {onRequest} from "firebase-functions/v2/https";
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

export const sendTestNotification = onRequest(
  {cors: true},
  async (req, res) => {
    const userId = req.query.userId;

    if (!userId || typeof userId !== "string") {
      res.status(400).send("Missing or invalid 'userId' query parameter.");
      return;
    }

    try {
      logger.info(`Attempting to send notification to user: ${userId}`);

      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) {
        logger.error(`User document not found for userId: ${userId}`);
        res.status(404).send("User not found.");
        return;
      }

      const fcmToken = userDoc.data()?.fcmToken;
      if (!fcmToken) {
        logger.warn(`FCM token not found for user: ${userId}`);
        res.status(404).send("FCM token for user not found.");
        return;
      }

      logger.info(`Found FCM token: ${fcmToken}`);

      const message = {
        notification: {
          title: "Test Notification",
          body: "Hello from a Cloud Function!",
        },
        token: fcmToken,
      };

      const response = await messaging.send(message);
      logger.info("Successfully sent message:", response);

      res.status(200).send(`Message sent successfully to user ${userId}`);
    } catch (error) {
      logger.error("Error sending message:", error);
      res.status(500).send("Error sending message");
    }
  },
);
