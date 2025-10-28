/* eslint-disable linebreak-style */
/* eslint-disable max-len */
/* eslint-disable indent */
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { v1 } from "@google-cloud/firestore";
import { onDocumentWritten, onDocumentCreated } from "firebase-functions/v2/firestore";

// Initialize Firebase Admin SDK
initializeApp();
const client = new v1.FirestoreAdminClient();
const db = getFirestore();

// Get project ID from environment variables
const project = process.env.GCLOUD_PROJECT;
if (!project) {
  throw new Error("GCLOUD_PROJECT environment variable not set.");
}
// Get storage bucket from environment variables
const bucket = `gs://${project}.appspot.com`;


/**
 * A scheduled Cloud Function that automatically
 *  backs up the entire Firestore database
 * to a Firebase Storage bucket every day.
 *
 * To use this function:
 * 1. Your Firebase project must be on the Blaze (pay-as-you-go) plan.
 * 2. You must enable the "Cloud Datastore Admin API"
 *  in the Google Cloud Console for your project.
 *
 * Backups are stored in the `backups` folder
 * in your default Firebase Storage bucket.
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

/**
 * A Cloud Function that triggers whenever a new document is created in the 'incidents' collection.
 * If the incident has a cost, it automatically creates a corresponding expense slip.
 */
export const createExpenseSlipFromIncident = onDocumentWritten("incidents/{incidentId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    logger.log("No data associated with the event, skipping.");
    return;
 }

  // If the incident is deleted, we don't need to do anything with expense slips here.
  // The app logic handles deleting the associated expense slip.
  if (!snapshot.after.exists) {
    logger.log(`Incident ${event.params.incidentId} was deleted. No action taken.`);
    return;
  }

  const incidentData = snapshot.after.data();
  const incidentId = event.params.incidentId;

  // Check if the incident has a cost, is not an intangible cost, and if the cost has changed.
  if (
    !incidentData ||
    incidentData.cost <= 0 ||
    incidentData.paymentMethod === "intangible_cost"
  ) {
    logger.log(`Incident ${incidentId} has no payable cost. Skipping expense slip creation.`);
    return;
 }

  // Find an existing expense slip to update it, or create a new one.
  const expenseSlipsRef = db.collection("expense_slips");
  const q = expenseSlipsRef
    .where("associatedIncidentId", "==", incidentId)
    .limit(1);
  const querySnapshot = await q.get();
  const existingSlip = querySnapshot.docs.length > 0 ? querySnapshot.docs[0] : null;

  // Prepare the data for the new expense slip
  const expenseSlipData = {
    date: incidentData.date,
    expenseType: "other_cost",
    items: [{
      itemId: "other_cost",
      name: `Chi phí sự cố: ${incidentData.content.substring(0, 50)}`,
      description: incidentData.content,
      quantity: 1,
      unitPrice: incidentData.cost,
      unit: "lần",
   }],
    totalAmount: incidentData.cost,
    paymentMethod: incidentData.paymentMethod,
    notes: `Tự động tạo từ báo cáo sự cố ID: ${incidentId}`,
    createdBy: incidentData.createdBy,
    associatedIncidentId: incidentId, // Link the slip to the incident
    paymentStatus: incidentData.paymentMethod === "cash" ? "paid" : "unpaid",
 };

  try {
    if (existingSlip) {
      await existingSlip.ref.update(expenseSlipData);
      logger.info(`Successfully updated expense slip ${existingSlip.id} for incident ID: ${incidentId}`);
    } else {
      const newSlipData = { ...expenseSlipData, createdAt: incidentData.createdAt };
      await expenseSlipsRef.add(newSlipData);
      logger.info(`Successfully created expense slip for incident ID: ${incidentId}`);
    }
 } catch (error) {
    logger.error(`Failed to create/update expense slip for incident ID: ${incidentId}`, error);
 }
});

/**
 * A Cloud Function that triggers when a revenue statistics document is created or updated.
 * If the document includes a `deliveryPartnerPayout`, it automatically creates
 * a corresponding expense slip for "Trả cho đối tác giao hàng".
 */
export const createExpenseSlipForDeliveryPayout = onDocumentWritten("revenue_stats/{statsId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    logger.log("No data associated with the event, skipping.");
    return;
  }

  // Handle deletion of a revenue stat -> do nothing
  if (!snapshot.after.exists) {
    return;
  }

  const revenueData = snapshot.after.data();
  // const beforeData = snapshot.before.data();
  const statsId = event.params.statsId;

   if (!revenueData) {
    logger.log("Revenue data is undefined, skipping.");
    return;
  }

  const payoutAmount = revenueData.deliveryPartnerPayout ? Math.abs(revenueData.deliveryPartnerPayout) : 0;

  // Find an existing auto-generated expense slip for this date
  const expenseSlipsRef = db.collection("expense_slips");
  const q = expenseSlipsRef
    .where("date", "==", revenueData.date)
    .where("autoGeneratedFor", "==", "delivery_payout")
    .limit(1);

  const querySnapshot = await q.get();
  const existingSlip = querySnapshot.docs.length > 0 ? querySnapshot.docs[0] : null;

  // If the payout amount hasn't changed, do nothing.
  // if (beforeData && beforeData.deliveryPartnerPayout === payoutAmount) {
  //   logger.log(`Payout amount for ${statsId} has not changed. Skipping.`);
  //   return;
  // }

  if (payoutAmount === 0) {
    // If the new payout is zero but a slip exists, delete the slip.
    if (existingSlip) {
      logger.log(`Payout for ${revenueData.date} is now 0. Deleting existing auto-generated expense slip ${existingSlip.id}.`);
      await existingSlip.ref.delete();
    }
    return;
  }

  // Prepare the data for the expense slip (for both create and update)
  const expenseSlipData = {
    date: revenueData.date,
    expenseType: "other_cost",
    items: [{
      itemId: "other_cost",
      name: "Chi trả cho Đối tác Giao hàng",
      description: `Đối tác giao hàng (GrabFood, ShopeeFood) thu hộ.`,
      quantity: 1,
      unitPrice: payoutAmount,
      unit: "lần",
    }],
    totalAmount: payoutAmount,
    // This is a non-cash deduction, so 'intangible_cost' is most appropriate.
    paymentMethod: "bank_transfer",
    notes: `Tự động cập nhật từ báo cáo doanh thu mới nhất ngày ${revenueData.date}. (ID: ${statsId})`,
    paymentStatus: "paid", // This is an automatic deduction, not a pending payment.
    autoGeneratedFor: "delivery_payout", // Custom field for easy querying.
    lastModified: revenueData.createdAt, // Keep this timestamp in sync with the revenue stat.
  };

  try {
    if (existingSlip) {
      // Update the existing slip
      await existingSlip.ref.update(expenseSlipData);
      logger.info(`Successfully updated expense slip ${existingSlip.id} for delivery payout from revenue stats ID: ${statsId}`);
    } else {
      // Create a new slip
      const newSlipData = {
        ...expenseSlipData,
        createdBy: revenueData.createdBy,
        createdAt: revenueData.createdAt,
      };
      await expenseSlipsRef.add(newSlipData);
      logger.info(`Successfully created new expense slip for delivery payout from revenue stats ID: ${statsId}`);
    }
  } catch (error) {
    logger.error(`Failed to create/update expense slip for revenue stats ID: ${statsId}`, error);
  }
});

/**
 * A Cloud Function that triggers when a new cash handover report is created.
 * It first checks for duplicates created by the same user within a short time frame (e.g., 2 minutes).
 * If a duplicate is found (same data, different timestamp), the newly created document is deleted.
 */
export const preventDuplicateCashHandover = onDocumentCreated("cash_handover_reports/{reportId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    logger.log("No data associated with the event, skipping.");
    return;
  }

  const newReport = snapshot.data();
  const newReportId = event.params.reportId;

  // Define a time window to check for duplicates (e.g., 2 minutes)
  const twoMinutes = 2 * 60 * 1000;
  const checkWindowStart = new Date(newReport.createdAt.toDate().getTime() - twoMinutes);

  // Query for documents from the same user on the same date within the time window
  const query = db.collection("cash_handover_reports")
    .where("date", "==", newReport.date)
    .where("createdBy.userId", "==", newReport.createdBy.userId)
    .where("createdAt", ">=", checkWindowStart)
    .where("createdAt", "<", newReport.createdAt);

  const querySnapshot = await query.get();

  if (querySnapshot.empty) {
    logger.log(`No potential duplicates found for report ${newReportId}.`);
    return;
  }

  // Function to compare two reports, ignoring timestamps and IDs
  const areReportsEqual = (report1: any, report2: any) => {
    // Sort arrays to ensure order doesn't affect comparison
    const sortedExpenses1 = [...(report1.linkedExpenseSlipIds || [])].sort();
    const sortedExpenses2 = [...(report2.linkedExpenseSlipIds || [])].sort();
    const sortedPhotos1 = [...(report1.discrepancyProofPhotos || [])].sort();
    const sortedPhotos2 = [...(report2.discrepancyProofPhotos || [])].sort();

    return (
      report1.actualCashCounted === report2.actualCashCounted &&
      report1.discrepancyReason === report2.discrepancyReason &&
      report1.startOfDayCash === report2.startOfDayCash &&
      report1.linkedRevenueStatsId === report2.linkedRevenueStatsId &&
      JSON.stringify(sortedExpenses1) === JSON.stringify(sortedExpenses2) &&
      JSON.stringify(sortedPhotos1) === JSON.stringify(sortedPhotos2)
    );
  };

  // Check if any of the recent documents is a duplicate
  for (const doc of querySnapshot.docs) {
    const existingReport = doc.data();
    if (areReportsEqual(newReport, existingReport)) {
      logger.warn(`Duplicate cash handover report detected. Deleting new report ${newReportId}. It is a duplicate of ${doc.id}.`);
      try {
        await db.collection("cash_handover_reports").doc(newReportId).delete();
        logger.info(`Successfully deleted duplicate report ${newReportId}.`);
      } catch (error) {
        logger.error(`Failed to delete duplicate report ${newReportId}.`, error);
      }
      return; // Stop after finding the first duplicate
    }
  }
});
