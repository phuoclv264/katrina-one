import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { v1 } from "@google-cloud/firestore";

// Initialize Firebase Admin SDK
initializeApp();
const client = new v1.FirestoreAdminClient();

// Get project ID from environment variables
const project = process.env.GCLOUD_PROJECT;
if (!project) {
  throw new Error("GCLOUD_PROJECT environment variable not set.");
}
// Get storage bucket from environment variables
const bucket = `gs://${project}.appspot.com`;


/**
 * A scheduled Cloud Function that automatically backs up the entire Firestore database
 * to a Firebase Storage bucket every day.
 *
 * To use this function:
 * 1. Your Firebase project must be on the Blaze (pay-as-you-go) plan.
 * 2. You must enable the "Cloud Datastore Admin API" in the Google Cloud Console for your project.
 *
 * Backups are stored in the `backups` folder in your default Firebase Storage bucket.
 * The folder name will be the date of the backup (e.g., YYYY-MM-DD).
 */
export const backupFirestore = onSchedule({
  schedule: "every day 03:00", // Runs at 3:00 AM every day
  timeZone: "Asia/Ho_Chi_Minh", // Vietnam timezone
}, async (event) => {
  const databaseName = client.databasePath(project, "(default)");
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");

  const outputUriPrefix = `${bucket}/backups/${year}-${month}-${day}`;

  logger.info(
    `Starting Firestore backup from ${databaseName} to ${outputUriPrefix}`
  );

  try {
    const [operation] = await client.exportDocuments({
      name: databaseName,
      outputUriPrefix,
      // Leave collectionIds empty to export all collections
      collectionIds: [],
    });

    const response = await operation.promise();
    const result = response[0];
    logger.info(`Backup operation completed with response: ${JSON.stringify(result)}`);
  } catch (error) {
    logger.error("Backup operation failed:", error);
    throw new Error("Firestore backup failed.");
  }
});
