import React, { useState, useEffect } from 'react';
import { getCurrentUserId } from '../state/useAuthStore';

export default function PhoneContactsSetup() {
  const [contacts, setContacts] = useState([]);
  const [newNumber, setNewNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const userId = getCurrentUserId() || 'mock_user_1';

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const res = await fetch(`/api/contacts/${userId}`);
      if (!res.ok) throw new Error('Failed to fetch contacts');
      const data = await res.json();
      setContacts(data.contacts || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newNumber.trim()) return;
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contacts/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: newNumber.trim() })
      });
      
      if (!res.ok) throw new Error('Failed to add contact');
      const data = await res.json();
      setContacts(data.contacts);
      setNewNumber('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/contacts/${userId}/${encodeURIComponent(number)}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) throw new Error('Failed to remove contact');
      const data = await res.json();
      setContacts(data.contacts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 mt-4">
      <div className="glass-card bg-[#111] p-4 rounded-xl border border-white/10 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30">
            <span className="text-xl">📞</span>
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-white text-sm">Phone Contacts</h4>
            <p className="text-xs text-gray-400">Receive automated voice calls & SMS</p>
          </div>
        </div>

        {error && <p className="text-xs text-red-400 bg-red-950/30 p-2 rounded">{error}</p>}

        <form onSubmit={handleAdd} className="flex gap-2 mt-2">
          <input 
            type="tel"
            placeholder="+1234567890"
            value={newNumber}
            onChange={(e) => setNewNumber(e.target.value)}
            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-green-500/50"
          />
          <button 
            type="submit"
            disabled={loading || !newNumber.trim()}
            className="px-4 py-2 bg-green-600/80 hover:bg-green-500 text-white text-xs font-bold rounded-lg disabled:opacity-50"
          >
            Add
          </button>
        </form>

        {contacts.length > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            <h5 className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Saved Numbers</h5>
            {contacts.map((num, i) => (
              <div key={i} className="flex justify-between items-center bg-white/5 p-2 rounded border border-white/5">
                <span className="text-xs font-mono text-gray-300">{num}</span>
                <button 
                  onClick={() => handleRemove(num)}
                  disabled={loading}
                  className="text-red-400 hover:text-red-300 text-xs px-2"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
