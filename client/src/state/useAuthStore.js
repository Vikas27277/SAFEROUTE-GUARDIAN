import { create } from 'zustand';
import { auth } from '../lib/firebase.js';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { USER_ROLES } from '../../../shared/communityReports.js';

export const useAuthStore = create((set, get) => ({
  currentUser: null,
  isAuthenticated: false,
  role: USER_ROLES.USER, // Default role
  loading: true,

  initializeAuth: () => {
    // Listen to Firebase Auth state changes
    if (!auth) {
      set({ loading: false });
      return () => {};
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        set({ 
          currentUser: user, 
          isAuthenticated: true,
          role: USER_ROLES.USER,
          loading: false 
        });
      } else {
        set({ 
          currentUser: null, 
          isAuthenticated: false,
          role: USER_ROLES.USER,
          loading: false 
        });
      }
    });

    return unsubscribe;
  },

  signIn: async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: userCredential.user };
    } catch (error) {
      return { success: false, error: mapAuthError(error) };
    }
  },

  signUp: async (email, password) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      return { success: true, user: userCredential.user };
    } catch (error) {
      return { success: false, error: mapAuthError(error) };
    }
  },

  signOut: async () => {
    try {
      await firebaseSignOut(auth);
      set({ currentUser: null, isAuthenticated: false, role: USER_ROLES.USER });
      return { success: true };
    } catch (error) {
      return { success: false, error: mapAuthError(error) };
    }
  },

  // Abstracted role resolution (to be backed by Firestore/Custom Claims in the future)
  resolveRole: async () => {
    const { currentUser } = get();
    if (!currentUser) return USER_ROLES.USER;
    
    // In this MVP step, we strictly enforce "user" role on the client side.
    // Later, this will check auth.currentUser.getIdTokenResult() for custom claims
    // or fetch from a secure /api/roles endpoint.
    return USER_ROLES.USER;
  }
}));

// Reusable auth helpers
export const isUserAuthenticated = () => useAuthStore.getState().isAuthenticated;
export const getCurrentUserId = () => useAuthStore.getState().currentUser?.uid || null;
export const getCurrentUserEmail = () => useAuthStore.getState().currentUser?.email || null;
export const getCurrentUserRole = () => useAuthStore.getState().role;

/**
 * Maps Supabase Auth errors to safe, user-friendly application messages.
 * Prevents raw error object exposure.
 */
function mapAuthError(error) {
  const message = error?.message || '';
  const status = error?.status || 0;
  
  if (message.includes('Invalid login credentials')) {
    return 'Invalid email or password.';
  }
  if (message.includes('User already registered') || status === 422) {
    return 'An account with this email already exists.';
  }
  if (message.includes('Password should be at least')) {
    return 'Password is too weak. Please use a stronger password.';
  }
  if (message.includes('Email link is invalid or has expired')) {
    return 'The verification link has expired. Please request a new one.';
  }
  if (message.includes('FetchError') || status === 0) {
    return 'Network error. Please check your connection and try again.';
  }
  if (status === 429) {
    return 'Too many failed login attempts. Please try again later.';
  }
  return 'An unexpected authentication error occurred. Please try again.';
}
