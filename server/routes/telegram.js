import express from 'express';
import { TelegramService } from '../services/telegramService.js';
import crypto from 'crypto';

const router = express.Router();

// Mock Data Stores (In production, use Firestore / Supabase)
// Stores linking codes mapped to user IDs
export const pendingLinks = new Map(); 
// Stores verified emergency contact chat IDs for a user: Map<UserId, Array<ChatId>>
export const userTelegramContacts = new Map();

/**
 * Endpoint to generate a new linking code for the current user.
 * The user will send this code to the Telegram bot to link their account.
 */
router.post('/generate-link', (req, res) => {
  // Mock authentication - replace with actual auth middleware in production
  const userId = req.body.userId || 'mock_user_1';
  
  // Generate a random 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Store code with expiration (e.g., 10 minutes)
  pendingLinks.set(code, {
    userId,
    expiresAt: Date.now() + 10 * 60 * 1000
  });

  res.json({ success: true, code });
});

/**
 * Webhook endpoint for Telegram Bot API.
 * Needs to be registered with Telegram via:
 * https://api.telegram.org/bot<TOKEN>/setWebhook?url=<YOUR_HTTPS_URL>/api/telegram/webhook
 */
router.post('/webhook', async (req, res) => {
  const update = req.body;

  // We only care about messages
  if (update.message && update.message.text) {
    const text = update.message.text;
    const chatId = update.message.chat.id;

    // Check if message is a /start command with a linking code
    if (text.startsWith('/start ')) {
      const code = text.split(' ')[1];
      
      const linkData = pendingLinks.get(code);
      
      if (linkData && linkData.expiresAt > Date.now()) {
        const userId = linkData.userId;
        
        // Link the chat ID to the user's emergency contacts
        const existingContacts = userTelegramContacts.get(userId) || [];
        if (!existingContacts.includes(chatId)) {
          existingContacts.push(chatId);
          userTelegramContacts.set(userId, existingContacts);
        }

        // Remove the used code
        pendingLinks.delete(code);

        // Notify the user in Telegram
        await TelegramService.sendMessage(chatId, '✅ <b>Successfully linked!</b>\n\nYou are now registered as an emergency contact. You will receive SOS alerts and live location tracking links if an emergency is triggered.');
      } else {
        await TelegramService.sendMessage(chatId, '❌ <b>Invalid or expired linking code.</b>\n\nPlease generate a new code in the SafeRoute Guardian app and try again.');
      }
    } else if (text === '/start') {
       await TelegramService.sendMessage(chatId, 'Welcome to SafeRoute Guardian Bot.\n\nTo become an emergency contact, please click the link provided in the SafeRoute Guardian app, or send <code>/start &lt;code&gt;</code>.');
    }
  }

  // Always acknowledge webhook immediately to prevent retries
  res.status(200).send('OK');
});

export default router;
