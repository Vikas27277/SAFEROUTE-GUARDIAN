import express from 'express';

const router = express.Router();

// Mock store for phone contacts: Map<UserId, Array<PhoneNumberString>>
export const userPhoneContacts = new Map();

/**
 * Get contacts for a user
 */
router.get('/:userId', (req, res) => {
  const { userId } = req.params;
  const contacts = userPhoneContacts.get(userId) || [];
  res.json({ success: true, contacts });
});

/**
 * Add a contact for a user
 */
router.post('/:userId', (req, res) => {
  const { userId } = req.params;
  const { phoneNumber } = req.body;
  
  if (!phoneNumber) {
    return res.status(400).json({ error: 'Phone number is required' });
  }
  
  const contacts = userPhoneContacts.get(userId) || [];
  if (!contacts.includes(phoneNumber)) {
    contacts.push(phoneNumber);
    userPhoneContacts.set(userId, contacts);
  }
  
  res.json({ success: true, contacts });
});

/**
 * Remove a contact
 */
router.delete('/:userId/:phoneNumber', (req, res) => {
  const { userId, phoneNumber } = req.params;
  let contacts = userPhoneContacts.get(userId) || [];
  
  contacts = contacts.filter(c => c !== phoneNumber);
  userPhoneContacts.set(userId, contacts);
  
  res.json({ success: true, contacts });
});

export default router;
