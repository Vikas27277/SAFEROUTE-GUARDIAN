import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

let app;

try {
  // If a JSON string is provided in the environment (common in CI/CD or restricted environments)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    app = initializeApp({
      credential: cert(serviceAccount)
    });
  } else {
    // Fallback to minimal initialization (allows token verification without full service account)
    app = initializeApp({
      projectId: 'saferoute-guardian-f69c7'
    });
    console.log('Firebase Admin initialized without credentials (token verification only)');
  }
} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK:', error);
  // Do not throw immediately so the server can still start (for health checks and copilot)
  // but subsequent db/auth calls will fail.
}

export const db = app ? getFirestore(app) : null;

// Supabase Client for Auth Verification
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'placeholder_anon_key';
export const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware to verify Firebase Auth ID token
export const verifyAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header.' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const { getAuth } = await import('firebase-admin/auth');
    const decodedToken = await getAuth(app).verifyIdToken(token);
    
    // Mount the decoded token (which includes uid) onto req.user
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase auth token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
  }
};
