import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import contactsRouter, { userPhoneContacts } from './contacts.js';

const app = express();
app.use(express.json());
app.use('/api/contacts', contactsRouter);

describe('Contacts API', () => {
  beforeEach(() => {
    userPhoneContacts.clear();
  });

  it('adds a new contact', async () => {
    const res = await request(app)
      .post('/api/contacts/user_1')
      .send({ phoneNumber: '+1234567890' });
      
    expect(res.status).toBe(200);
    expect(res.body.contacts).toContain('+1234567890');
    expect(userPhoneContacts.get('user_1')).toContain('+1234567890');
  });

  it('retrieves contacts', async () => {
    userPhoneContacts.set('user_1', ['+111', '+222']);
    
    const res = await request(app).get('/api/contacts/user_1');
    expect(res.status).toBe(200);
    expect(res.body.contacts).toEqual(['+111', '+222']);
  });

  it('removes a contact', async () => {
    userPhoneContacts.set('user_1', ['+111', '+222']);
    
    const res = await request(app).delete('/api/contacts/user_1/%2B111');
    expect(res.status).toBe(200);
    expect(res.body.contacts).toEqual(['+222']);
    expect(userPhoneContacts.get('user_1')).toEqual(['+222']);
  });
});
