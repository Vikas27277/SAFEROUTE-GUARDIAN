import React, { useState } from 'react';
import { getCurrentUserId } from '../state/useAuthStore';

export default function TelegramSetup() {
  const [linkingCode, setLinkingCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerateCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/telegram/generate-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: getCurrentUserId() || 'mock_user_1' })
      });
      
      if (!res.ok) throw new Error('Failed to generate code');
      
      const data = await res.json();
      setLinkingCode(data.code);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-bold text-sm text-[var(--color-sr-text-primary)] uppercase tracking-wider">
        Emergency Contacts
      </h3>
      
      <div className="glass-card bg-[#111] p-4 rounded-xl border border-white/10 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
            <span className="text-xl">✈️</span>
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-white text-sm">Telegram Integration</h4>
            <p className="text-xs text-gray-400">Link contacts to receive SOS alerts</p>
          </div>
        </div>

        {error && <p className="text-xs text-red-400 bg-red-950/30 p-2 rounded">{error}</p>}

        {!linkingCode ? (
          <button 
            onClick={handleGenerateCode}
            disabled={loading}
            className="mt-2 text-xs py-2 px-4 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/5 font-semibold"
          >
            {loading ? 'Generating...' : 'Add Telegram Contact'}
          </button>
        ) : (
          <div className="mt-2 bg-black/40 p-3 rounded-lg border border-blue-500/30 flex flex-col items-center text-center gap-2">
            <p className="text-xs text-gray-300">Ask your emergency contact to send this code to our Telegram Bot:</p>
            <div className="text-2xl font-mono font-black text-blue-400 tracking-widest bg-black px-4 py-2 rounded border border-white/5">
              /start {linkingCode}
            </div>
            <p className="text-[10px] text-gray-500 mt-1">Code expires in 10 minutes</p>
            <button 
              onClick={() => setLinkingCode(null)}
              className="text-[10px] text-gray-400 hover:text-white mt-2 underline"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
