import { expect, test, describe, vi, beforeEach } from 'vitest';
import { useAuthStore, isUserAuthenticated, getCurrentUserId, getCurrentUserRole } from './useAuthStore.js';
import { USER_ROLES } from '../../../shared/communityReports.js';

// Mock Firebase
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
  getApp: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  onAuthStateChanged: vi.fn((auth, callback) => {
    // Return a mock unsubscribe function
    return vi.fn();
  }),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn()
}));

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn()
}));

describe('Authentication Store', () => {
  beforeEach(() => {
    // Reset state before each test
    useAuthStore.setState({
      currentUser: null,
      isAuthenticated: false,
      role: USER_ROLES.USER,
      loading: true
    });
  });

  test('Initial state is correctly set (unauthenticated, loading)', () => {
    const state = useAuthStore.getState();
    expect(state.currentUser).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.loading).toBe(true);
    expect(state.role).toBe(USER_ROLES.USER);
  });

  test('Auth helpers return correct default values', () => {
    expect(isUserAuthenticated()).toBe(false);
    expect(getCurrentUserId()).toBeNull();
    expect(getCurrentUserRole()).toBe(USER_ROLES.USER);
  });

  test('State updates correctly for authenticated user', () => {
    useAuthStore.setState({
      currentUser: { uid: 'user123', email: 'test@example.com' },
      isAuthenticated: true,
      loading: false,
      role: USER_ROLES.USER
    });

    expect(isUserAuthenticated()).toBe(true);
    expect(getCurrentUserId()).toBe('user123');
    expect(useAuthStore.getState().role).toBe(USER_ROLES.USER);
  });

  test('Role resolution defaults to USER', async () => {
    useAuthStore.setState({
      currentUser: { uid: 'user123' },
      isAuthenticated: true
    });
    const state = useAuthStore.getState();
    const resolvedRole = await state.resolveRole();
    expect(resolvedRole).toBe(USER_ROLES.USER);
  });

  test('Role resolution returns USER even if unauthenticated', async () => {
    const state = useAuthStore.getState();
    const resolvedRole = await state.resolveRole();
    expect(resolvedRole).toBe(USER_ROLES.USER);
  });
});
