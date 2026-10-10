import express from 'express';
import { db, verifyAuth } from '../firebaseAdmin.js';
import { VOTE_TYPES, REPORT_STATUS, MODERATOR_DECISIONS, REPORT_CATEGORIES } from '../../shared/communityReports.js';
import { computeVoteDelta, evaluateReportStatus } from '../../shared/communityVerification.js';
import { DEFAULT_CONFIG } from '../../shared/scoringConfig.js';

const router = express.Router();

/**
 * POST /api/reports
 * Body: { category, title, description, location: { type: 'Point', coordinates: [lng, lat] }, imageUrls, severity }
 * Requires Authentication
 */
router.post('/reports', verifyAuth, async (req, res) => {
  if (!db) {
    return res.status(500).json({ error: 'Database not initialized' });
  }

  const { category, title, description, location, imageUrls, severity } = req.body;
  const uid = req.user.uid;
  const config = DEFAULT_CONFIG.communityReports;

  // 1. Validation
  const errors = [];
  
  if (!category || !Object.values(REPORT_CATEGORIES).includes(category)) {
    errors.push('Invalid or missing report category.');
  }
  
  if (!location || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
    errors.push('Invalid or missing location coordinates.');
  } else if (location.type !== 'Point') {
    errors.push('Location type must be "Point".');
  } else {
    const [lng, lat] = location.coordinates;
    if (typeof lng !== 'number' || typeof lat !== 'number' || Math.abs(lng) > 180 || Math.abs(lat) > 90) {
      errors.push('Coordinates must be valid finite numbers.');
    }
  }

  if (!description || description.trim().length === 0) {
    errors.push('Description is required.');
  } else if (description.length > config.maxReportDescriptionLength) {
    errors.push(`Description exceeds the maximum length of ${config.maxReportDescriptionLength} characters.`);
  }

  // imageUrls is optional — an empty array is valid (no photo attached)
  const normalizedImageUrls = Array.isArray(imageUrls) ? imageUrls : [];
  if (normalizedImageUrls.length > config.maxImagesPerReport) {
    errors.push(`Maximum of ${config.maxImagesPerReport} images allowed.`);
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(' ') });
  }

  const reportRef = db.collection('reports').doc();
  const now = Date.now();
  const expiryMs = config.defaultReportExpiryHours * 60 * 60 * 1000;

  const reportDoc = {
    id: reportRef.id,
    category,
    title: title || category.replace('_', ' ').toUpperCase(),
    description,
    location: {
      type: "Point",
      coordinates: location.coordinates
    },
    imageUrls: normalizedImageUrls,
    createdBy: uid,
    createdAt: now,
    reportedAt: now,
    lastConfirmedAt: null,
    expiresAt: now + expiryMs,
    status: REPORT_STATUS.PENDING,
    severity: severity || 'Medium',
    community: {
      confirmCount: 0,
      inaccurateCount: 0,
      totalVotes: 0,
      verificationConfidence: 0
    },
    moderator: {
      decision: null,
      moderatorId: null,
      decidedAt: null,
      reason: null
    },
    source: "community"
  };

  try {
    await reportRef.set(reportDoc);
    return res.status(201).json(reportDoc);
  } catch (error) {
    console.error('Failed to create report:', error);
    return res.status(500).json({ error: 'Failed to create report.' });
  }
});

/**
 * GET /api/reports
 * Fetches reports and filters out private PII / moderation notes.
 * Applies server-side expiry evaluation.
 */
router.get('/reports', async (req, res) => {
  if (!db) {
    return res.status(500).json({ error: 'Database not initialized' });
  }

  try {
    const snapshot = await db.collection('reports').get();
    const now = Date.now();
    
    const publicReports = snapshot.docs.map(doc => {
      const data = doc.data();
      
      // Server-side dynamic expiry check
      let currentStatus = data.status;
      if (currentStatus !== REPORT_STATUS.EXPIRED && data.expiresAt && now > data.expiresAt) {
        currentStatus = REPORT_STATUS.EXPIRED;
        // Optionally update it in DB asynchronously, but we definitely return it as EXPIRED
        doc.ref.update({ status: REPORT_STATUS.EXPIRED }).catch(console.error);
      }
      
      // Return privacy-safe version
      return {
        id: data.id,
        category: data.category,
        title: data.title,
        description: data.description,
        location: data.location,
        imageUrls: data.imageUrls,
        createdAt: data.createdAt,
        reportedAt: data.reportedAt,
        lastConfirmedAt: data.lastConfirmedAt,
        expiresAt: data.expiresAt,
        status: currentStatus,
        severity: data.severity,
        community: data.community,
        moderator: {
          decision: data.moderator?.decision || null,
          decidedAt: data.moderator?.decidedAt || null
        },
        source: data.source,
        // _createdBy and _moderatorId are scrubbed for privacy
      };
    });

    return res.status(200).json(publicReports);
  } catch (error) {
    console.error('Failed to fetch reports:', error);
    return res.status(500).json({ error: 'Failed to fetch reports.' });
  }
});

/**
 * POST /api/reports/:id/vote
 */
router.post('/reports/:id/vote', verifyAuth, async (req, res) => {
  if (!db) {
    return res.status(500).json({ error: 'Database not initialized' });
  }

  const { id } = req.params;
  const { vote } = req.body;
  const uid = req.user.uid;

  if (!Object.values(VOTE_TYPES).includes(vote)) {
    return res.status(400).json({ error: 'Invalid vote type.' });
  }

  const reportRef = db.collection('reports').doc(id);
  const voteRef = db.collection(`reports/${id}/votes`).doc(uid);

  try {
    const result = await db.runTransaction(async (t) => {
      const reportDoc = await t.get(reportRef);
      if (!reportDoc.exists) {
        throw new Error('Report does not exist.');
      }

      const reportData = reportDoc.data();

      // Check if report is eligible for voting
      if ([REPORT_STATUS.EXPIRED, REPORT_STATUS.REJECTED, REPORT_STATUS.MODERATOR_VERIFIED].includes(reportData.status)) {
        throw new Error(`Cannot vote on a report with status ${reportData.status}.`);
      }

      // Creator cannot vote on their own report
      if (reportData.createdBy === uid) {
        throw new Error('You cannot vote on your own report.');
      }

      const voteDoc = await t.get(voteRef);
      let previousVote = null;

      if (voteDoc.exists) {
        previousVote = voteDoc.data().vote;
        if (previousVote === vote) {
          return { status: 200, data: reportData.community };
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

      t.update(reportRef, {
        community: updatedCommunity,
        status: newStatus,
        lastConfirmedAt: newLastConfirmedAt
      });

      t.set(voteRef, {
        userId: uid,
        reportId: id,
        vote: vote,
        createdAt: voteDoc.exists ? voteDoc.data().createdAt : now,
        updatedAt: now
      });

      return { status: 200, data: updatedCommunity };
    });

    return res.status(result.status).json(result.data);
  } catch (error) {
    console.error('Vote transaction failed:', error);
    return res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/reports/:id/moderate
 * Body: { decision: 'verify' | 'reject' | 'dismiss', reason: 'string' }
 * Requires Authentication and Moderator Role
 */
router.post('/reports/:id/moderate', verifyAuth, async (req, res) => {
  if (!db) {
    return res.status(500).json({ error: 'Database not initialized' });
  }

  // Ensure user is moderator or admin
  if (req.user.role !== 'moderator' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Requires moderator privileges.' });
  }

  const { id } = req.params;
  const { decision, reason } = req.body;
  const uid = req.user.uid;

  if (!Object.values(MODERATOR_DECISIONS).includes(decision)) {
    return res.status(400).json({ error: 'Invalid moderator decision.' });
  }

  const reportRef = db.collection('reports').doc(id);
  const logRef = db.collection('moderationLogs').doc();

  try {
    const result = await db.runTransaction(async (t) => {
      const reportDoc = await t.get(reportRef);
      if (!reportDoc.exists) {
        throw new Error('Report does not exist.');
      }

      const reportData = reportDoc.data();
      const now = Date.now();

      const moderatorUpdate = {
        decision,
        reason: reason || null,
        moderatorId: uid,
        decidedAt: now
      };

      const tempReport = {
        ...reportData,
        moderator: moderatorUpdate
      };

      const newStatus = evaluateReportStatus(tempReport);

      t.update(reportRef, {
        moderator: moderatorUpdate,
        status: newStatus
      });

      t.set(logRef, {
        reportId: id,
        moderatorId: uid,
        decision,
        reason: reason || null,
        timestamp: now,
        previousStatus: reportData.status,
        newStatus: newStatus
      });

      return { status: 200, data: { status: newStatus, moderator: moderatorUpdate } };
    });

    return res.status(result.status).json(result.data);
  } catch (error) {
    console.error('Moderation transaction failed:', error);
    return res.status(400).json({ error: error.message });
  }
});

export default router;
