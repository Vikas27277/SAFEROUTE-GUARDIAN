import { db, auth } from './firebase.js';
import { doc, collection, runTransaction } from 'firebase/firestore';
import { MODERATOR_DECISIONS, REPORT_STATUS, USER_ROLES } from '../../../shared/communityReports.js';
import { evaluateReportStatus } from '../../../shared/communityVerification.js';
import { useAuthStore } from '../state/useAuthStore.js';

/**
 * Validates whether the currently authenticated user has moderator or admin privileges.
 */
export async function isModerator() {
  // In a full implementation, this should check a secure custom claim or backend endpoint.
  // For this MVP step, we rely on the auth store's resolved role (which should be backed by a trusted source).
  const role = await useAuthStore.getState().resolveRole();
  return role === USER_ROLES.MODERATOR || role === USER_ROLES.ADMIN;
}

/**
 * Submits a moderator decision on a report.
 * @param {string} reportId 
 * @param {string} decision (from MODERATOR_DECISIONS)
 * @param {string} reason 
 * @returns {Promise<Object>} The updated report data
 */
export async function moderateReport(reportId, decision, reason) {
  if (!auth.currentUser) {
    throw new Error('User must be authenticated to perform moderator actions.');
  }

  const hasAccess = await isModerator();
  if (!hasAccess) {
    throw new Error('Insufficient permissions. User is not a moderator or admin.');
  }

  if (!Object.values(MODERATOR_DECISIONS).includes(decision)) {
    throw new Error('Invalid moderator decision.');
  }

  // Basic reason validation
  const safeReason = reason?.trim();
  if (safeReason && safeReason.length > 500) {
    throw new Error('Moderator reason is too long (max 500 characters).');
  }

  const uid = auth.currentUser.uid;
  const reportRef = doc(db, 'reports', reportId);
  const logRef = doc(collection(db, 'moderationLogs'));

  return await runTransaction(db, async (transaction) => {
    const reportDoc = await transaction.get(reportRef);
    if (!reportDoc.exists()) {
      throw new Error('Report does not exist.');
    }

    const reportData = reportDoc.data();
    const previousStatus = reportData.status;

    // Check concurrency: "First decision wins" policy or explicitly require a new audit log
    // We allow a moderator to overwrite an existing decision, but it must be fully audited.
    
    const now = Date.now();

    // 1. Prepare new moderator object
    const updatedModerator = {
      decision: decision,
      moderatorId: uid,
      decidedAt: now,
      reason: safeReason || null
    };

    // 2. Evaluate new status
    const tempReport = {
      ...reportData,
      moderator: updatedModerator
    };
    
    // Pure function handles mapping MODERATOR_VERIFIED, REJECTED, or falling back to community for DISMISS
    const newStatus = evaluateReportStatus(tempReport);

    // 3. Write report update
    transaction.update(reportRef, {
      moderator: updatedModerator,
      status: newStatus
    });

    // 4. Write audit log
    transaction.set(logRef, {
      reportId: reportId,
      moderatorId: uid,
      decision: decision,
      previousStatus: previousStatus,
      newStatus: newStatus,
      reason: safeReason || null,
      createdAt: now
    });

    tempReport.status = newStatus;
    return tempReport;
  });
}
