import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import communityRoutes from './community.js';

// Mock dependencies BEFORE importing the router fully initialized
vi.mock('../firebaseAdmin.js', () => {
  return {
    db: {
      collection: vi.fn(),
      runTransaction: vi.fn()
    },
    verifyAuth: (req, res, next) => {
      // Allow overriding user for tests
      if (req.headers.authorization === 'Bearer VALID_TOKEN') {
        req.user = { uid: 'user_123', role: 'user' };
        return next();
      }
      if (req.headers.authorization === 'Bearer MOD_TOKEN') {
        req.user = { uid: 'mod_123', role: 'moderator' };
        return next();
      }
      return res.status(401).json({ error: 'Unauthorized' });
    }
  };
});

import { db } from '../firebaseAdmin.js';

const app = express();
app.use(express.json());
app.use('/api', communityRoutes);
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

describe('Community Routes API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock: returns doc/get
    db.collection.mockImplementation(() => ({
      doc: vi.fn(() => ({
        set: vi.fn().mockResolvedValue(),
        update: vi.fn().mockResolvedValue(),
        get: vi.fn().mockResolvedValue({ exists: false })
      })),
      get: vi.fn().mockResolvedValue({ docs: [] })
    }));
  });

  describe('POST /api/reports', () => {
    it('1. Rejects unauthenticated requests', async () => {
      const response = await request(app)
        .post('/api/reports')
        .send({});
      
      expect(response.status).toBe(401);
    });

    it('2. Rejects invalid coordinates', async () => {
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', 'Bearer VALID_TOKEN')
        .send({
          category: 'pothole',
          description: 'A bad pothole',
          location: { type: 'Point', coordinates: [999, 999] },
          imageUrls: ['http://example.com/img.jpg']
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('valid finite numbers');
    });

    it('3. Accepts report without images (photos are optional)', async () => {
      const mockSet = vi.fn().mockResolvedValue();
      const mockDoc = vi.fn(() => ({ id: 'no_img_report', set: mockSet }));
      db.collection.mockImplementation(() => ({ doc: mockDoc }));

      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', 'Bearer VALID_TOKEN')
        .send({
          category: 'pothole',
          description: 'A bad pothole',
          location: { type: 'Point', coordinates: [77.6, 12.9] }
        });
      
      expect(response.status).toBe(201);
      expect(response.body.imageUrls).toEqual([]);
    });

    it('4. Successfully creates a report', async () => {
      const mockSet = vi.fn().mockResolvedValue();
      const mockDoc = vi.fn(() => ({ id: 'new_report_123', set: mockSet }));
      db.collection.mockImplementation(() => ({ doc: mockDoc }));

      const payload = {
        category: 'pothole',
        description: 'A bad pothole',
        location: { type: 'Point', coordinates: [77.6, 12.9] },
        imageUrls: ['http://example.com/img.jpg']
      };

      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', 'Bearer VALID_TOKEN')
        .send(payload);
      
      expect(response.status).toBe(201);
      expect(response.body.status).toBe('PENDING');
      expect(mockSet).toHaveBeenCalled();
    });
  });

  describe('GET /api/reports', () => {
    it('1. Fetches reports and strips PII', async () => {
      const mockDocs = [
        {
          id: 'report_1',
          data: () => ({
            id: 'report_1',
            category: 'pothole',
            status: 'COMMUNITY_VERIFIED',
            location: { type: 'Point', coordinates: [0, 0] },
            createdBy: 'secret_user_id',
            expiresAt: Date.now() + 100000
          }),
          ref: { update: vi.fn() }
        }
      ];
      db.collection.mockImplementation(() => ({ get: vi.fn().mockResolvedValue({ docs: mockDocs }) }));

      const response = await request(app).get('/api/reports');
      expect(response.status).toBe(200);
      expect(response.body[0].createdBy).toBeUndefined();
    });

    it('2. Evaluates expiry dynamically', async () => {
      const mockUpdate = vi.fn().mockResolvedValue();
      const mockDocs = [
        {
          id: 'report_old',
          data: () => ({
            id: 'report_old',
            category: 'pothole',
            status: 'PENDING',
            expiresAt: Date.now() - 10000
          }),
          ref: { update: mockUpdate }
        }
      ];
      db.collection.mockImplementation(() => ({ get: vi.fn().mockResolvedValue({ docs: mockDocs }) }));

      const response = await request(app).get('/api/reports');
      expect(response.status).toBe(200);
      expect(response.body[0].status).toBe('EXPIRED');
    });
  });

  describe('POST /api/reports/:id/vote', () => {
    it('1. Rejects unauthenticated requests', async () => {
      const response = await request(app).post('/api/reports/123/vote').send({ vote: 'confirm' });
      expect(response.status).toBe(401);
    });

    it('2. Rejects self-voting', async () => {
      db.runTransaction.mockImplementation(async (callback) => {
        const mockT = {
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ createdBy: 'user_123', status: 'PENDING', community: { confirmCount: 0, totalVotes: 0 } })
          })
        };
        try {
          return await callback(mockT);
        } catch (e) {
          return { status: 400, data: { error: e.message } };
        }
      });

      const response = await request(app)
        .post('/api/reports/123/vote')
        .set('Authorization', 'Bearer VALID_TOKEN')
        .send({ vote: 'confirm' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('own report');
    });
  });

  describe('POST /api/reports/:id/moderate', () => {
    it('1. Rejects non-moderators', async () => {
      const response = await request(app)
        .post('/api/reports/123/moderate')
        .set('Authorization', 'Bearer VALID_TOKEN')
        .send({ decision: 'verify' });
      
      expect(response.status).toBe(403);
    });

    it('2. Allows moderators', async () => {
      db.runTransaction.mockImplementation(async (callback) => {
        const mockT = {
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ status: 'PENDING', moderator: {}, community: { confirmCount: 0, totalVotes: 0 } })
          }),
          update: vi.fn(),
          set: vi.fn()
        };
        return await callback(mockT);
      });

      const response = await request(app)
        .post('/api/reports/123/moderate')
        .set('Authorization', 'Bearer MOD_TOKEN')
        .send({ decision: 'verify' });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('MODERATOR_VERIFIED');
    });
  });
});
