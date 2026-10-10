/**
 * Service for interacting with the official Telegram Bot API.
 */
import dotenv from 'dotenv';
dotenv.config();

const getBaseUrl = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('[WARNING] TELEGRAM_BOT_TOKEN is not set in environment variables.');
    return null;
  }
  return `https://api.telegram.org/bot${token}`;
};

export class TelegramService {
  
  /**
   * Sends a text message to a specific Telegram chat.
   */
  static async sendMessage(chatId, text, options = {}) {
    const baseUrl = getBaseUrl();
    if (!baseUrl) return null;

    try {
      const response = await fetch(`${baseUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML',
          ...options
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`[TelegramService] Failed to send message to ${chatId}:`, errorData);
        throw new Error(errorData.description || 'Failed to send Telegram message');
      }

      return await response.json();
    } catch (error) {
      console.error('[TelegramService] Network or API error in sendMessage:', error);
      throw error;
    }
  }

  /**
   * Sends a live location message that can be updated over time.
   * @param {string|number} chatId 
   * @param {number} latitude 
   * @param {number} longitude 
   * @param {number} livePeriod - How long the location will be live (in seconds). Maximum 86400 (24h).
   */
  static async sendLiveLocation(chatId, latitude, longitude, livePeriod = 3600) {
    const baseUrl = getBaseUrl();
    if (!baseUrl) return null;

    try {
      const response = await fetch(`${baseUrl}/sendLocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          latitude,
          longitude,
          live_period: livePeriod
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`[TelegramService] Failed to send live location to ${chatId}:`, errorData);
        throw new Error(errorData.description || 'Failed to send Telegram live location');
      }

      return await response.json();
    } catch (error) {
      console.error('[TelegramService] Network or API error in sendLiveLocation:', error);
      throw error;
    }
  }

  /**
   * Updates an existing live location message with new coordinates.
   */
  static async editMessageLiveLocation(chatId, messageId, latitude, longitude) {
    const baseUrl = getBaseUrl();
    if (!baseUrl) return null;

    try {
      const response = await fetch(`${baseUrl}/editMessageLiveLocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          latitude,
          longitude
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Ignore "message is not modified" errors which happen if GPS hasn't moved enough
        if (errorData.description && errorData.description.includes('message is not modified')) {
          return null;
        }
        
        console.error(`[TelegramService] Failed to edit live location (msg ${messageId}):`, errorData);
        throw new Error(errorData.description || 'Failed to edit Telegram live location');
      }

      return await response.json();
    } catch (error) {
      console.error('[TelegramService] Network or API error in editMessageLiveLocation:', error);
      throw error;
    }
  }

  /**
   * Stops updating a live location message immediately.
   */
  static async stopMessageLiveLocation(chatId, messageId) {
    const baseUrl = getBaseUrl();
    if (!baseUrl) return null;

    try {
      const response = await fetch(`${baseUrl}/stopMessageLiveLocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`[TelegramService] Failed to stop live location (msg ${messageId}):`, errorData);
        // It might already be stopped/expired, so we just log it and don't necessarily throw
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('[TelegramService] Network or API error in stopMessageLiveLocation:', error);
      // Non-fatal
      return null;
    }
  }
}
