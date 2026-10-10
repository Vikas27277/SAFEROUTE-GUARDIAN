import twilio from 'twilio';

let twilioClient = null;

// Initialize Twilio client lazily to allow tests to mock env vars easily
const getClient = () => {
  if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
};

export const TwilioService = {
  /**
   * Initiates a voice call playing an automated TwiML message.
   * @param {string} toPhoneNumber 
   * @param {object} location { lat, lng }
   */
  async makeEmergencyCall(toPhoneNumber, location) {
    const client = getClient();
    if (!client) {
      console.warn('Twilio credentials missing. Skipping emergency call.');
      return { ok: false, error: 'Credentials missing' };
    }

    try {
      const locationText = location && location.lat 
        ? `Latitude ${location.lat}, Longitude ${location.lng}` 
        : 'Unknown location';
      
      const twiml = `
        <Response>
          <Say voice="alice" language="en-US">
            Emergency Alert from SafeRoute Guardian. 
            The user has triggered an SOS. 
            Their current coordinates are: ${locationText}.
            Please check the SMS sent to this number for a live tracking link.
            Goodbye.
          </Say>
        </Response>
      `;

      const call = await client.calls.create({
        twiml: twiml,
        to: toPhoneNumber,
        from: process.env.TWILIO_PHONE_NUMBER
      });

      return { ok: true, sid: call.sid };
    } catch (error) {
      console.error('[TwilioService] Failed to make call:', error);
      return { ok: false, error: error.message };
    }
  },

  /**
   * Sends an SMS message with a tracking link.
   * @param {string} toPhoneNumber 
   * @param {string} trackingLink 
   */
  async sendEmergencySMS(toPhoneNumber, trackingLink) {
    const client = getClient();
    if (!client) {
      console.warn('Twilio credentials missing. Skipping SMS.');
      return { ok: false, error: 'Credentials missing' };
    }

    try {
      const message = await client.messages.create({
        body: `🚨 EMERGENCY SOS 🚨\nUser triggered an SOS via SafeRoute Guardian.\nTrack them live here: ${trackingLink}`,
        to: toPhoneNumber,
        from: process.env.TWILIO_PHONE_NUMBER
      });

      return { ok: true, sid: message.sid };
    } catch (error) {
      console.error('[TwilioService] Failed to send SMS:', error);
      return { ok: false, error: error.message };
    }
  }
};
