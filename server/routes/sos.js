import express from 'express';
import { TelegramService } from '../services/telegramService.js';
import { TwilioService } from '../services/twilioService.js';
import crypto from 'crypto';
import { userTelegramContacts } from './telegram.js';
import { userPhoneContacts } from './contacts.js';

const router = express.Router();

// Mock Data Store for SOS Sessions
// Map<SessionId, SessionObject>
export const sosSessions = new Map();

/**
 * Start an SOS Session
 */
router.post('/start', async (req, res) => {
  try {
    const { userId, location, rideContext } = req.body;
    const uid = userId || 'mock_user_1';
    
    // Check if user has telegram contacts and phone contacts
    const telegramContacts = userTelegramContacts.get(uid) || [];
    const phoneContacts = userPhoneContacts.get(uid) || [];
    
    // Create a new secure session
    const sessionId = crypto.randomUUID();
    const sharingToken = crypto.randomBytes(16).toString('hex');
    
    const sessionData = {
      id: sessionId,
      userId: uid,
      status: 'active',
      startedAt: Date.now(),
      sharingToken,
      lastLocation: location,
      telegramMessages: [] // Array to keep track of { chatId, messageId } for live location
    };

    // Construct the Secure Live Map URL
    const baseUrl = process.env.CORS_ORIGIN || 'http://localhost:5173';
    const trackUrl = `${baseUrl}/?track=${sharingToken}`;

    let notifiedTelegramCount = 0;
    let notifiedPhoneCount = 0;
    
    // Send messages to all registered Telegram contacts
    for (const chatId of telegramContacts) {
      try {
        let messageText = `🚨 <b>EMERGENCY SOS ALERT</b> 🚨\n\nUser has triggered an SOS.\n<b>Time:</b> ${new Date().toLocaleString()}\n`;
        
        if (rideContext) {
          messageText += `\n🚗 <b>Active Ride Context:</b>\nProvider: ${rideContext.provider}\nDriver: ${rideContext.driverName || 'Unknown'}\nVehicle: ${rideContext.vehicleRegistration || 'Unknown'}\n`;
        }
        
        messageText += `\n📍 <a href="${trackUrl}">View Secure Live Map</a>\n\n<i>Live location updates will follow in the next message.</i>`;
        
        await TelegramService.sendMessage(chatId, messageText);
        
        if (location && location.lat && location.lng) {
          const liveLocRes = await TelegramService.sendLiveLocation(chatId, location.lat, location.lng, 3600);
          if (liveLocRes && liveLocRes.ok) {
            sessionData.telegramMessages.push({
              chatId: chatId,
              messageId: liveLocRes.result.message_id
            });
          }
        }
        notifiedTelegramCount++;
      } catch (err) {
        console.error(`Failed to notify telegram contact ${chatId}:`, err);
      }
    }

    // Trigger Twilio Phone Calls and SMS
    for (const phoneNumber of phoneContacts) {
      try {
        await TwilioService.sendEmergencySMS(phoneNumber, trackUrl);
        await TwilioService.makeEmergencyCall(phoneNumber, location);
        notifiedPhoneCount++;
      } catch (err) {
        console.error(`Failed to notify phone contact ${phoneNumber}:`, err);
      }
    }

    sosSessions.set(sharingToken, sessionData);

    res.json({ 
      success: true, 
      sessionId, 
      sharingToken, 
      notifiedContacts: notifiedTelegramCount + notifiedPhoneCount,
      telegramCount: notifiedTelegramCount,
      phoneCount: notifiedPhoneCount
    });
    
  } catch (error) {
    console.error('Failed to start SOS:', error);
    res.status(500).json({ error: 'Failed to trigger SOS' });
  }
});

/**
 * Update SOS Location
 * Called continuously by the client device while SOS is active.
 */
router.post('/update', async (req, res) => {
  try {
    const { sharingToken, location } = req.body;
    
    const session = sosSessions.get(sharingToken);
    if (!session || session.status !== 'active') {
      return res.status(403).json({ error: 'Invalid or inactive session' });
    }

    // Update in-memory last location for the tracking link
    session.lastLocation = location;

    // Push updates to Telegram Live Location messages
    if (location && location.lat && location.lng) {
      for (const msg of session.telegramMessages) {
        // Fire and forget, don't wait for all to complete
        TelegramService.editMessageLiveLocation(msg.chatId, msg.messageId, location.lat, location.lng).catch(e => {
          // Ignore unmodified message errors
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update location' });
  }
});

/**
 * Stop SOS Session
 */
router.post('/stop', async (req, res) => {
  try {
    const { sharingToken } = req.body;
    
    const session = sosSessions.get(sharingToken);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    session.status = 'ended';
    session.endedAt = Date.now();

    // Stop Telegram live location
    for (const msg of session.telegramMessages) {
      await TelegramService.stopMessageLiveLocation(msg.chatId, msg.messageId).catch(() => {});
      await TelegramService.sendMessage(msg.chatId, `✅ <b>SOS Session Ended</b>\n\nThe user has marked themselves as safe and ended the emergency broadcast at ${new Date().toLocaleString()}.`).catch(() => {});
    }

    // Optional: Keep session in map but marked as ended so tracker knows it ended
    // sosSessions.delete(sharingToken);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to stop SOS' });
  }
});

/**
 * Endpoint for the Secure Live Map to poll the current location
 */
router.get('/track/:token', (req, res) => {
  const { token } = req.params;
  const session = sosSessions.get(token);
  
  if (!session) {
    return res.status(404).json({ error: 'Tracking session not found or expired.' });
  }

  // Calculate staleness (if location is older than 2 minutes)
  const isStale = (Date.now() - session.lastLocation.timestamp) > 120000;

  res.json({
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    location: session.lastLocation,
    isStale
  });
});

export default router;
