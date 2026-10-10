import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import sosRouter, { sosSessions } from './sos.js';
import telegramRouter, { pendingLinks, userTelegramContacts } from './telegram.js';
import { TelegramService } from '../services/telegramService.js';

const app = express();
app.use(express.json());
app.use('/api/sos', sosRouter);
app.use('/api/telegram', telegramRouter);

vi.mock('../services/telegramService.js', () => ({
  TelegramService: {
    sendMessage: vi.fn(),
    sendLiveLocation: vi.fn(),
    editMessageLiveLocation: vi.fn(),
    stopMessageLiveLocation: vi.fn()
  }
}));

describe('SOS and Telegram Backend Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sosSessions.clear();
    pendingLinks.clear();
    userTelegramContacts.clear();
  });

  describe('Telegram Linking', () => {
    it('generates a link code', async () => {
      const res = await request(app)
        .post('/api/telegram/generate-link')
        .send({ userId: 'test_user_1' });
        
      expect(res.status).toBe(200);
      expect(res.body.code).toBeDefined();
      expect(pendingLinks.size).toBe(1);
    });

    it('webhooks /start <code_number> successfully links contact', async () => {
      // Pre-populate a code
      pendingLinks.set('123456', { userId: 'user_1', expiresAt: Date.now() + 100000 });
      
      const res = await request(app)
        .post('/api/telegram/webhook')
        .send({
          message: {
            text: '/start 123456',
            chat: { id: 987654321 }
          }
        });
        
      expect(res.status).toBe(200);
      expect(pendingLinks.size).toBe(0); // Code consumed
      expect(userTelegramContacts.get('user_1')).toContain(987654321);
      expect(TelegramService.sendMessage).toHaveBeenCalledWith(987654321, expect.stringContaining('Successfully linked'));
    });
  });

  describe('SOS Session Management', () => {
    beforeEach(() => {
      userTelegramContacts.set('test_user', [111, 222]); // Two contacts
      TelegramService.sendMessage.mockResolvedValue({ ok: true });
      TelegramService.sendLiveLocation.mockResolvedValue({ ok: true, result: { message_id: 999 } });
      TelegramService.editMessageLiveLocation.mockResolvedValue({ ok: true });
      TelegramService.stopMessageLiveLocation.mockResolvedValue({ ok: true });
    });

    it('starts an SOS session and notifies contacts', async () => {
      const res = await request(app)
        .post('/api/sos/start')
        .send({
          userId: 'test_user',
          location: { lat: 10, lng: 20, timestamp: Date.now() }
        });
        
      expect(res.status).toBe(200);
      expect(res.body.sharingToken).toBeDefined();
      expect(res.body.notifiedContacts).toBe(2);
      
      const session = sosSessions.get(res.body.sharingToken);
      expect(session).toBeDefined();
      expect(session.status).toBe('active');
      expect(session.telegramMessages.length).toBe(2); // One per contact for live location
    });

    it('updates live location', async () => {
      // Start session manually
      sosSessions.set('mock_token', {
        status: 'active',
        telegramMessages: [{ chatId: 111, messageId: 999 }]
      });

      const res = await request(app)
        .post('/api/sos/update')
        .send({
          sharingToken: 'mock_token',
          location: { lat: 11, lng: 21, timestamp: Date.now() }
        });
        
      expect(res.status).toBe(200);
      expect(TelegramService.editMessageLiveLocation).toHaveBeenCalledWith(111, 999, 11, 21);
    });

    it('stops SOS session and halts live location', async () => {
      sosSessions.set('mock_token', {
        status: 'active',
        telegramMessages: [{ chatId: 111, messageId: 999 }]
      });

      const res = await request(app)
        .post('/api/sos/stop')
        .send({ sharingToken: 'mock_token' });
        
      expect(res.status).toBe(200);
      expect(sosSessions.get('mock_token').status).toBe('ended');
      expect(TelegramService.stopMessageLiveLocation).toHaveBeenCalledWith(111, 999);
      expect(TelegramService.sendMessage).toHaveBeenCalledWith(111, expect.stringContaining('SOS Session Ended'));
    });

    it('allows tracking via token', async () => {
      sosSessions.set('mock_token', {
        status: 'active',
        startedAt: 1000,
        lastLocation: { lat: 10, lng: 20, timestamp: Date.now() }
      });

      const res = await request(app).get('/api/sos/track/mock_token');
      expect(res.status).toBe(200);
      expect(res.body.location.lat).toBe(10);
      expect(res.body.isStale).toBe(false);
    });
  });
});
