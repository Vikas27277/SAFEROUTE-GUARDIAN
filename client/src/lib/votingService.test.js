import { expect, test, describe, vi, beforeEach } from 'vitest';
import { voteOnReport } from './votingService.js';
import { VOTE_TYPES, REPORT_STATUS } from '../../../shared/communityReports.js';
import { auth } from './firebase.js';

vi.mock('./firebase.js', () => ({
  db: {},
  auth: { currentUser: null }
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  runTransaction: vi.fn(async (db, cb) => {
    // Mock the transaction object
    const transaction = {
      get: vi.fn(),
      update: vi.fn(),
      set: vi.fn()
    };
    return cb(transaction);
  })
}));

describe('Voting Service', () => {
  beforeEach(() => {
    auth.currentUser = { uid: 'user123' };
  });

  test('Rejects if unauthenticated', async () => {
    auth.currentUser = null;
    await expect(voteOnReport('report1', VOTE_TYPES.CONFIRM)).rejects.toThrow(/User must be authenticated/);
  });

  test('Rejects invalid vote type', async () => {
    await expect(voteOnReport('report1', 'INVALID_VOTE')).rejects.toThrow(/Invalid vote type/);
  });
  
  // Note: we've thoroughly tested the pure calculation logic in communityVerification.test.js
  // The transaction wrapper is heavily dependent on Firebase, which we mock above.
});
