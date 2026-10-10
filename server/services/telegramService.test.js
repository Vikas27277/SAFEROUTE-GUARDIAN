import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TelegramService } from './telegramService.js';

describe('TelegramService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, TELEGRAM_BOT_TOKEN: 'test_token' };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('sendMessage sends correct payload', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 1 } })
    });

    const res = await TelegramService.sendMessage('12345', 'Hello World');
    
    expect(res.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest_token/sendMessage',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"chat_id":"12345"')
      })
    );
  });

  it('sendLiveLocation handles success', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 2 } })
    });

    const res = await TelegramService.sendLiveLocation('123', 12.0, 77.0, 3600);
    expect(res.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"latitude":12')
      })
    );
  });

  it('editMessageLiveLocation ignores unmodified errors', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ ok: false, description: 'Bad Request: message is not modified' })
    });

    const res = await TelegramService.editMessageLiveLocation('123', 2, 12.1, 77.1);
    expect(res).toBeNull(); // Should not throw
  });

  it('throws on other API errors', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ ok: false, description: 'Forbidden: bot was blocked by the user' })
    });

    await expect(TelegramService.sendMessage('123', 'Test')).rejects.toThrow(/blocked/);
  });
});
