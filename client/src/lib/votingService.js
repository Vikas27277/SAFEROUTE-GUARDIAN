import { db, auth } from './firebase.js';
import { doc, runTransaction } from 'firebase/firestore';
import { VOTE_TYPES, REPORT_STATUS } from '../../../shared/communityReports.js';
import { computeVoteDelta, evaluateReportStatus } from '../../../shared/communityVerification.js';

/**
 * Casts or updates a vote on a report using a Firestore Transaction.
 * @param {string} reportId 
 * @param {string} vote (from VOTE_TYPES)
 * @returns {Promise<Object>} Updated community counters
 */
export async function voteOnReport(reportId, vote) {
  if (!auth.currentUser) {
    throw new Error('User must be authenticated to vote.');
  }
  
  if (!Object.values(VOTE_TYPES).includes(vote)) {
    throw new Error('Invalid vote type.');
  }

  const uid = auth.currentUser.uid;
  const reportRef = doc(db, 'reports', reportId);
  const voteRef = doc(db, 'reports', reportId, 'votes', uid);

  return await runTransaction(db, async (transaction) => {
    const reportDoc = await transaction.get(reportRef);
    if (!reportDoc.exists()) {
      throw new Error('Report does not exist.');
    }

    const reportData = reportDoc.data();

    // Check if report is eligible for voting
    if (reportData.status === REPORT_STATUS.EXPIRED || reportData.status === REPORT_STATUS.REJECTED || reportData.status === REPORT_STATUS.MODERATOR_VERIFIED) {
      throw new Error(`Cannot vote on a report with status ${reportData.status}.`);
    }

    const voteDoc = await transaction.get(voteRef);
    let previousVote = null;
    
    if (voteDoc.exists()) {
      previousVote = voteDoc.data().vote;
      if (previousVote === vote) {
        // User hasn't changed their vote. Safe to ignore.
        return reportData.community;
      }
    }

    // 1. Calculate new community counters
    const updatedCommunity = computeVoteDelta(reportData.community, previousVote, vote);

    // 2. Determine new status
    const tempReport = {
      ...reportData,
      community: updatedCommunity
    };
    
    const newStatus = evaluateReportStatus(tempReport);
    
    // 3. Last Confirmed At
    const now = Date.now();
    let newLastConfirmedAt = reportData.lastConfirmedAt;
    if (vote === VOTE_TYPES.CONFIRM) {
      newLastConfirmedAt = now;
    }

    // Apply updates
    transaction.update(reportRef, {
      community: updatedCommunity,
      status: newStatus,
      lastConfirmedAt: newLastConfirmedAt
    });

    transaction.set(voteRef, {
      userId: uid,
      reportId: reportId,
      vote: vote,
      createdAt: voteDoc.exists() ? voteDoc.data().createdAt : now,
      updatedAt: now
    });

    return updatedCommunity;
  });
}
