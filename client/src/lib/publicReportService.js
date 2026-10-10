import { db } from './firebase.js';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { REPORT_STATUS } from '../../../shared/communityReports.js';

/**
 * Fetches reports that are allowed to appear publicly.
 * Reads directly from Firestore.
 */
export async function getPublicReports() {
  const reportsRef = collection(db, 'reports');
  
  // Note: Firestore 'in' queries support up to 10 comparison values
  const q = query(
    reportsRef,
    where('status', 'in', [
      REPORT_STATUS.PENDING,
      REPORT_STATUS.COMMUNITY_VERIFIED,
      REPORT_STATUS.MODERATOR_VERIFIED,
      REPORT_STATUS.DISPUTED
    ])
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
