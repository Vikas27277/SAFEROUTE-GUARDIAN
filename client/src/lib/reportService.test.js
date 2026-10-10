import { expect, test, describe, vi, beforeEach } from 'vitest';
import { validateReportPayload, createReport } from './reportService.js';
import { REPORT_CATEGORIES, REPORT_STATUS } from '../../../shared/communityReports.js';
import { DEFAULT_CONFIG } from '../../../shared/scoringConfig.js';
import { auth } from './firebase.js';
import { getCurrentUserId } from '../state/useAuthStore.js';

// Mock Auth Store
vi.mock('../state/useAuthStore.js', () => ({
  getCurrentUserId: vi.fn(() => 'user123')
}));

// Mock Firebase
vi.mock('./firebase.js', () => {
  return {
    db: {},
    storage: {},
    auth: {
      currentUser: null
    }
  };
});

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(() => ({ id: 'test-report-id' })),
  setDoc: vi.fn(async () => {}),
  serverTimestamp: vi.fn(() => 123456789)
}));

vi.mock('./supabase.js', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ data: { path: 'test-path' }, error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.com/test-image.jpg' } }))
      }))
    }
  }
}));

describe('Report Service Validation', () => {
  let validPayload;

  beforeEach(() => {
    // Reset mock auth state
    auth.currentUser = { uid: 'user123' };

    validPayload = {
      category: REPORT_CATEGORIES.BLOCKED_ROAD,
      title: 'Road blocked',
      description: 'A large tree fell on the road.',
      location: { type: 'Point', coordinates: [77.5946, 12.9716] }, // lng, lat
      images: [
        { name: 'test.jpg', type: 'image/jpeg', size: 1024 * 1024 } // 1MB
      ]
    };
  });

  test('1. unauthenticated submission rejected', () => {
    getCurrentUserId.mockReturnValueOnce(null);
    const result = validateReportPayload(validPayload);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/User must be authenticated/);
  });

  test('2. missing category rejected', () => {
    validPayload.category = null;
    const result = validateReportPayload(validPayload);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('Invalid or missing report category'))).toBe(true);
  });

  test('3. missing description rejected', () => {
    validPayload.description = '   ';
    const result = validateReportPayload(validPayload);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('Description is required'))).toBe(true);
  });

  test('4. missing location rejected', () => {
    validPayload.location = { coordinates: [77.5946] }; // missing lat
    const result = validateReportPayload(validPayload);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('Invalid or missing location coordinates'))).toBe(true);
  });

  test('5. empty images array is valid (photos are optional)', () => {
    validPayload.images = [];
    const result = validateReportPayload(validPayload);
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  test('5b. undefined images is valid (photos are optional)', () => {
    validPayload.images = undefined;
    const result = validateReportPayload(validPayload);
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  test('6. more than configured images rejected', () => {
    validPayload.images = [
      { name: '1.jpg', type: 'image/jpeg', size: 1000 },
      { name: '2.jpg', type: 'image/jpeg', size: 1000 },
      { name: '3.jpg', type: 'image/jpeg', size: 1000 }
    ];
    const result = validateReportPayload(validPayload);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('Maximum of'))).toBe(true);
  });

  test('7. image over size limit rejected', () => {
    validPayload.images = [
      { name: 'large.jpg', type: 'image/jpeg', size: 6 * 1024 * 1024 } // 6MB
    ];
    const result = validateReportPayload(validPayload);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('exceeds the maximum size'))).toBe(true);
  });

  test('8. unsupported file type rejected', () => {
    validPayload.images = [
      { name: 'test.pdf', type: 'application/pdf', size: 1000 }
    ];
    const result = validateReportPayload(validPayload);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('unsupported format'))).toBe(true);
  });

  test('9. valid report passes validation', () => {
    const result = validateReportPayload(validPayload);
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
  });
});

describe('Report Creation Flow', () => {
  let validPayload;

  beforeEach(() => {
    auth.currentUser = { uid: 'user123' };
    validPayload = {
      category: REPORT_CATEGORIES.POORLY_LIT,
      title: 'Dark street',
      description: 'Streetlights are broken.',
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
      images: [
        { name: 'test.jpg', type: 'image/jpeg', size: 1024 * 1024 }
      ]
    };
  });

  test('10. coordinates remain [lng, lat] and valid fields are set', async () => {
    const report = await createReport(validPayload);
    
    expect(report.location.type).toBe('Point');
    expect(report.location.coordinates).toEqual([77.5946, 12.9716]);
    expect(report.userId).toBe('user123');
  });

  test('11-13. new report starts as PENDING with zeroed counters', async () => {
    const report = await createReport(validPayload);
    
    expect(report.status).toBe(REPORT_STATUS.PENDING);
    expect(report.upvotes).toBe(0);
  });

  test('14. createdAt is set using serverTimestamp', async () => {
    const report = await createReport(validPayload);
    
    expect(report.createdAt).toBe(123456789);
  });
});
