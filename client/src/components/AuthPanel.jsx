import React, { useState } from 'react';
import { useAuthStore } from '../state/useAuthStore';

export default function AuthPanel() {
  const { currentUser, isAuthenticated, signIn, signUp, signOut, role } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const action = isLogin ? signIn : signUp;
    const res = await action(email, password);
    if (!res.success) {
      setError(res.error);
      if (res.error === 'An account with this email already exists.') {
        setIsLogin(true);
      }
    }
  };

  if (isAuthenticated && currentUser) {
    return (
      <div className="bg-[var(--color-sr-secondary)] border border-[var(--color-sr-border)] p-4 rounded-xl shadow-md mb-4">
        <p className="text-sm text-[var(--color-sr-text-secondary)] mb-2">Signed in as <strong className="text-[var(--color-sr-text-primary)]">{currentUser.email}</strong></p>
        <p className="text-xs text-[var(--color-sr-text-muted)] mb-3">Role: {role}</p>
        <button 
          onClick={signOut}
          className="premium-button text-red-400 text-sm py-2 px-3 rounded-lg w-full transition-all"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-sr-secondary)] border border-[var(--color-sr-border)] p-4 rounded-xl shadow-md mb-4">
      <h3 className="font-bold text-[var(--color-sr-text-primary)] mb-3">{isLogin ? 'Sign In' : 'Sign Up'}</h3>
      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <input 
          type="email" 
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email" 
          required
          className="w-full premium-input rounded-lg px-3 py-2 text-sm text-[var(--color-sr-text-primary)]"
        />
        <input 
          type="password" 
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password" 
          required
          className="w-full premium-input rounded-lg px-3 py-2 text-sm text-[var(--color-sr-text-primary)]"
        />
        <button type="submit" className="w-full premium-button text-[var(--color-sr-text-primary)] text-sm py-2 rounded-lg font-medium transition-all">
          {isLogin ? 'Sign In' : 'Sign Up'}
        </button>
      </form>
      <button 
        onClick={() => setIsLogin(!isLogin)}
        className="w-full text-xs text-[var(--color-sr-text-secondary)] hover:text-[var(--color-sr-text-primary)] mt-3 text-center transition-colors"
      >
        {isLogin ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
      </button>
    </div>
  );
}
