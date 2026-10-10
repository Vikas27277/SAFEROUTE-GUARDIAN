import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import express from 'express';
import { REPORT_STATUS, VOTE_TYPES } from '../../shared/communityReports.js';
import { createReportRouter, validateReportInput } from './reportRouter.js';

const NOW = Date.UTC(2026, 0, 1, 12);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

class Snapshot {
  constructor(ref, data) {
    this.ref = ref;
    this.id = ref.id;
    this.exists = data !== undefined;
    this.value = data;
  }
  data() { return this.value; }
}

class DocumentRef {
  constructor(db, path) {
    this.db = db;
    this.path = path;
    this.id = path.split('/').at(-1);
  }
  collection(name) { return new Query(this.db, `${this.path}/${name}`); }
}

class Query {
  constructor(db, path) { this.db = db; this.path = path; }
  doc(id) { return new DocumentRef(this.db, `${this.path}/${id || `generated-${++this.db.nextId}`}`); }
  limit() { return this; }
  async get() {
    const prefix = `${this.path}/`;
    const docs = [...this.db.records.entries()]
      .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
      .map(([path, data]) => new Snapshot(new DocumentRef(this.db, path), data));
    return { docs, forEach: callback => docs.forEach(callback) };
  }
}

class MemoryDb {
  constructor() { this.records = new Map(); this.nextId = 0; }
  collection(name) { return new Query(this, name); }
  snapshot(ref) { return new Snapshot(ref, this.records.get(ref.path)); }
  async runTransaction(callback) {
    const writes = [];
    const transaction = {
      get: target => target instanceof Query ? target.get() : Promise.resolve(this.snapshot(target)),
      set: (ref, data) => writes.push(() => this.records.set(ref.path, structuredClone(data))),
      update: (ref, data) => writes.push(() => this.records.set(ref.path, { ...this.records.get(ref.path), ...structuredClone(data) }))
    };
    const result = await callback(transaction);
    writes.forEach(write => write());
    return result;
  }
  seed(path, data) { this.records.set(path, structuredClone(data)); }
}

const reportRecord = (overrides = {}) => ({
  id: 'report-1',
  category: 'pothole',
  title: 'Road hazard',
  description: 'A pothole on the road.',
  location: { type: 'Point', coordinates: [77.5946, 12.9716] },
  imageUrls: [],
  createdBy: 'reporter',
  reportedAt: NOW,
  lastConfirmedAt: null,
  expiresAt: NOW + 24 * 60 * 60 * 1000,
  status: REPORT_STATUS.PENDING,
  severity: 1,
  community: { confirmCount: 999, inaccurateCount: 0, totalVotes: 999, verificationConfidence: 1 },
  moderator: { decision: null, moderatorId: null, reason: null },
  ...overrides
});

function validPayload(overrides = {}) {
  return {
    category: 'pothole',
    title: 'Road hazard',
    description: 'A pothole on the road.',
    location: [77.5946, 12.9716],
    images: [{ type: 'image/png', data: PNG.toString('base64') }],
    ...overrides
  };
}

function createHarness({ seed = [], identities = {} } = {}) {
  const db = new MemoryDb();
  seed.forEach(([path, data]) => db.seed(path, data));
  const bucketRecords = new Map();
  const services = {
    db,
    auth: { verifyIdToken: async token => {
      if (!identities[token]) throw new Error('invalid token');
      return identities[token];
    } },
    bucket: { file: path => ({
      save: async (bytes, metadata) => bucketRecords.set(path, { bytes, metadata }),
      getSignedUrl: async () => [`https://images.test/${encodeURIComponent(path)}`],
      delete: async () => bucketRecords.delete(path)
    }) }
  };
  const app = express();
  app.use('/api/reports', express.json({ limit: '15mb' }), createReportRouter({ getServices: () => services, now: () => NOW }));
  const server = app.listen(0);
  return new Promise(resolve => server.once('listening', () => resolve({
    db,
    bucketRecords,
    baseUrl: `http://127.0.0.1:${server.address().port}/api/reports`,
    close: () => new Promise((done, reject) => server.close(error => error ? reject(error) : done()))
  })));
}

describe('Community report API security', () => {
  let harness;

  before(async () => {
    harness = await createHarness({ identities: {
      reporterToken: { uid: 'reporter', role: 'user' },
      voterToken: { uid: 'voter', role: 'user' },
      moderatorToken: { uid: 'moderator', role: 'moderator' }
    } });
  });
  after(async () => harness.close());

  it('rejects unauthenticated report creation', async () => {
    const response = await fetch(harness.baseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(validPayload()) });
    assert.equal(response.status, 401);
  });

  it('rejects invalid categories, description lengths, severities, and coordinates', () => {
    assert.equal(validateReportInput(validPayload({ category: 'crime' })).valid, false);
    assert.equal(validateReportInput(validPayload({ description: 'x'.repeat(301) })).valid, false);
    assert.equal(validateReportInput(validPayload({ severity: 6 })).valid, false);
    assert.equal(validateReportInput(validPayload({ location: [12.9716, 77.5946] })).valid, false);
    assert.equal(validateReportInput(validPayload({ location: [NaN, 12.9716] })).valid, false);
  });

  it('rejects excessive, mismatched, and too many image uploads', () => {
    assert.equal(validateReportInput(validPayload({ images: [{ type: 'image/png', data: Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64') }] })).valid, false);
    assert.equal(validateReportInput(validPayload({ images: [{ type: 'image/png', data: Buffer.from('not png').toString('base64') }] })).valid, false);
    assert.equal(validateReportInput(validPayload({ images: [validPayload().images[0], validPayload().images[0], validPayload().images[0]] })).valid, false);
  });

  it('uses token identity and returns a privacy-safe report projection', async () => {
    const payload = validPayload({ createdBy: 'attacker', status: REPORT_STATUS.MODERATOR_VERIFIED, community: { totalVotes: 500 }, moderator: { decision: 'verify', reason: 'private' } });
    const response = await fetch(harness.baseUrl, {
      method: 'POST',
      headers: { Authorization: 'Bearer reporterToken', 'Content-Type': 'application/json', 'Idempotency-Key': 'request-key-000001' },
      body: JSON.stringify(payload)
    });
    assert.equal(response.status, 201);
    const result = (await response.json()).report;
    assert.deepEqual(result.location, [77.5946, 12.9716]);
    assert.equal(result.status, REPORT_STATUS.PENDING);
    assert.equal(result.createdBy, undefined);
    assert.equal(result.moderator.moderatorId, undefined);
    assert.equal(result.moderator.reason, undefined);
    const saved = harness.db.records.get(`reports/${result.id}`);
    assert.equal(saved.createdBy, 'reporter');
    assert.equal(saved.community.totalVotes, 0);
    assert.equal(saved.moderator.decision, null);
  });

  it('treats matching idempotency keys as one report creation', async () => {
    const payload = validPayload();
    const submit = () => fetch(harness.baseUrl, {
      method: 'POST',
      headers: { Authorization: 'Bearer reporterToken', 'Content-Type': 'application/json', 'Idempotency-Key': 'repeat-request-0001' },
      body: JSON.stringify(payload)
    });
    const first = await submit();
    const firstBody = await first.json();
    const retry = await submit();
    const retryBody = await retry.json();
    assert.equal(first.status, 201);
    assert.equal(retry.status, 200);
    assert.equal(retryBody.report.id, firstBody.report.id);
    assert.equal([...harness.db.records.keys()].filter(path => path.startsWith('reports/')).length, 1);
    assert.equal(harness.bucketRecords.size, 1);
  });

  it('returns public reports without reporter or private moderation fields and recomputes vote counts', async () => {
    const db = new MemoryDb();
    db.seed('reports/pub', reportRecord({ moderator: { decision: 'verify', moderatorId: 'private-mod', reason: 'internal note' } }));
    const publicHarness = await createHarness({ seed: [
      ['reports/pub', reportRecord({ moderator: { decision: 'verify', moderatorId: 'private-mod', reason: 'internal note' } })],
      ['reports/pub/votes/u1', { vote: VOTE_TYPES.CONFIRM }]
    ] });
    try {
      const response = await fetch(publicHarness.baseUrl);
      assert.equal(response.status, 200);
      const report = (await response.json()).reports[0];
      assert.equal(report.status, REPORT_STATUS.MODERATOR_VERIFIED);
      assert.equal(report.community.totalVotes, 1);
      assert.equal(report.community.confirmCount, 1);
      assert.equal(report.createdBy, undefined);
      assert.equal(report.moderator.moderatorId, undefined);
      assert.equal(report.moderator.reason, undefined);
      assert.deepEqual(report.location, [77.5946, 12.9716]);
    } finally {
      await publicHarness.close();
    }
  });

  it('prevents creator self-voting and ignores forged stored vote totals', async () => {
    const votingHarness = await createHarness({ seed: [['reports/report-1', reportRecord()]], identities: {
      reporterToken: { uid: 'reporter', role: 'user' }, voterToken: { uid: 'voter', role: 'user' }
    } });
    try {
      const selfVote = await fetch(`${votingHarness.baseUrl}/report-1/votes`, {
        method: 'POST', headers: { Authorization: 'Bearer reporterToken', 'Content-Type': 'application/json' }, body: JSON.stringify({ vote: 'confirm' })
      });
      assert.equal(selfVote.status, 403);
      const vote = await fetch(`${votingHarness.baseUrl}/report-1/votes`, {
        method: 'POST', headers: { Authorization: 'Bearer voterToken', 'Content-Type': 'application/json' }, body: JSON.stringify({ vote: 'confirm' })
      });
      const body = await vote.json();
      assert.equal(body.community.totalVotes, 1);
      assert.equal(body.community.confirmCount, 1);
      assert.equal(body.status, REPORT_STATUS.PENDING);
    } finally {
      await votingHarness.close();
    }
  });

  it('allows one vote per user, preserves count on duplicates, and applies vote changes', async () => {
    const votingHarness = await createHarness({ seed: [['reports/report-1', reportRecord({ community: {} })]], identities: {
      reporterToken: { uid: 'reporter', role: 'user' }, voterToken: { uid: 'voter', role: 'user' }
    } });
    try {
      const sendVote = vote => fetch(`${votingHarness.baseUrl}/report-1/votes`, {
        method: 'POST', headers: { Authorization: 'Bearer voterToken', 'Content-Type': 'application/json' }, body: JSON.stringify({ vote })
      });
      await sendVote('confirm');
      const duplicate = await (await sendVote('confirm')).json();
      assert.equal(duplicate.community.totalVotes, 1);
      const changed = await (await sendVote('inaccurate')).json();
      assert.equal(changed.community.confirmCount, 0);
      assert.equal(changed.community.inaccurateCount, 1);
      assert.equal(changed.community.totalVotes, 1);
    } finally {
      await votingHarness.close();
    }
  });

  it('enforces per-user vote rate limits', async () => {
    const rateHarness = await createHarness({ seed: [['reports/report-1', reportRecord()]], identities: {
      reporterToken: { uid: 'reporter', role: 'user' }, voterToken: { uid: 'voter', role: 'user' }
    } });
    try {
      for (let index = 0; index < 30; index += 1) {
        const vote = index % 2 ? 'confirm' : 'inaccurate';
        const response = await fetch(`${rateHarness.baseUrl}/report-1/votes`, {
          method: 'POST', headers: { Authorization: 'Bearer voterToken', 'Content-Type': 'application/json' }, body: JSON.stringify({ vote })
        });
        assert.equal(response.status, 200);
      }
      const limited = await fetch(`${rateHarness.baseUrl}/report-1/votes`, {
        method: 'POST', headers: { Authorization: 'Bearer voterToken', 'Content-Type': 'application/json' }, body: JSON.stringify({ vote: 'confirm' })
      });
      assert.equal(limited.status, 429);
    } finally {
      await rateHarness.close();
    }
  });

  it('verifies only at the configured threshold and gives moderator rejection precedence', async () => {
    const votingHarness = await createHarness({ seed: [['reports/report-1', reportRecord({ community: {} })]], identities: {
      reporterToken: { uid: 'reporter', role: 'user' },
      ...Object.fromEntries(Array.from({ length: 5 }, (_, index) => [`voter${index}`, { uid: `voter-${index}`, role: 'user' }])),
      moderatorToken: { uid: 'moderator', role: 'moderator' }, ordinaryToken: { uid: 'ordinary', role: 'user' }
    } });
    try {
      let result;
      for (let index = 0; index < 5; index += 1) {
        result = await fetch(`${votingHarness.baseUrl}/report-1/votes`, {
          method: 'POST', headers: { Authorization: `Bearer voter${index}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ vote: 'confirm' })
        });
      }
      assert.equal((await result.json()).status, REPORT_STATUS.COMMUNITY_VERIFIED);
      const denied = await fetch(`${votingHarness.baseUrl}/report-1/moderation`, {
        method: 'POST', headers: { Authorization: 'Bearer ordinaryToken', 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: 'reject' })
      });
      assert.equal(denied.status, 403);
      const moderated = await fetch(`${votingHarness.baseUrl}/report-1/moderation`, {
        method: 'POST', headers: { Authorization: 'Bearer moderatorToken', 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: 'reject', reason: 'Not substantiated' })
      });
      assert.equal((await moderated.json()).report.status, REPORT_STATUS.REJECTED);
    } finally {
      await votingHarness.close();
    }
  });

  it('enforces per-user report rate limits', async () => {
    const rateHarness = await createHarness({ identities: { reporterToken: { uid: 'reporter', role: 'user' } } });
    try {
      for (let index = 0; index < 5; index += 1) {
        const response = await fetch(rateHarness.baseUrl, {
          method: 'POST',
          headers: { Authorization: 'Bearer reporterToken', 'Content-Type': 'application/json', 'Idempotency-Key': `rate-limit-key-${index}` },
          body: JSON.stringify(validPayload({ description: `Different road hazard ${index}.` }))
        });
        assert.equal(response.status, 201);
      }
      const limited = await fetch(rateHarness.baseUrl, {
        method: 'POST',
        headers: { Authorization: 'Bearer reporterToken', 'Content-Type': 'application/json', 'Idempotency-Key': 'rate-limit-key-final' },
        body: JSON.stringify(validPayload({ description: 'Different sixth road hazard.' }))
      });
      assert.equal(limited.status, 429);
    } finally {
      await rateHarness.close();
    }
  });
});