import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../state/useStore';
import { getCurrentUserId } from '../state/useAuthStore';

export default function SOSControl() {
  const [state, setState] = useState('idle');
  const [countdown, setCountdown] = useState(5);
  const [sharingToken, setSharingToken] = useState(null);
  const [notifiedCount, setNotifiedCount] = useState(0);
  const [error, setError] = useState(null);
  const { currentLocation, setIsSOSActive } = useStore();
  
  // Track active interval for location updates
  const updateIntervalRef = useRef(null);

  // Countdown timer logic
  useEffect(() => {
    let timer;
    if (state === 'countdown') {
      if (countdown > 0) {
        timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      } else {
        timer = setTimeout(() => handleDispatchSOS(), 0);
      }
    }
    return () => clearTimeout(timer);
  }, [state, countdown]);

  // Live Location Update logic
  useEffect(() => {
    if (state === 'active' && sharingToken) {
      // Send location update every 10 seconds
      updateIntervalRef.current = setInterval(() => {
        if (currentLocation && currentLocation.length === 2) {
          const locObj = { lat: currentLocation[1], lng: currentLocation[0] };
          fetch('/api/sos/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sharingToken,
              location: locObj
            })
          }).catch(err => console.error('Failed to push location update:', err));
        }
      }, 10000);
    } else {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    }

    return () => {
      if (updateIntervalRef.current) clearInterval(updateIntervalRef.current);
    };
  }, [state, sharingToken, currentLocation]);

  const handleStart = () => {
    setError(null);
    setState('confirm');
  };
  
  const handleConfirm = () => {
    setCountdown(5);
    setState('countdown');
  };
  
  const handleCancel = () => setState('idle');

  const handleDispatchSOS = async () => {
    setState('dispatching');
    setIsSOSActive(true); // Ask geolocation to start tracking!
    
    try {
      let locObj = null;
      if (currentLocation && currentLocation.length === 2) {
        locObj = { lat: currentLocation[1], lng: currentLocation[0] };
      } else {
        // Fallback: forcefully request position once if not navigating
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
          });
          locObj = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch (e) {
          console.warn('Could not get immediate position for SOS start', e);
        }
      }

      const res = await fetch('/api/sos/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: getCurrentUserId() || 'mock_user_1',
          location: locObj
        })
      });

      if (!res.ok) throw new Error('Network response was not ok');
      const data = await res.json();
      
      setSharingToken(data.sharingToken);
      setNotifiedCount(data.notifiedContacts);
      setState('active');
      
    } catch (err) {
      console.error(err);
      setError('Failed to trigger SOS on the server. Call emergency services directly.');
      setState('error');
      setIsSOSActive(false);
    }
  };

  const handleStopSOS = async () => {
    setState('stopping');
    setIsSOSActive(false); // Stop tracking if not navigating
    try {
      await fetch('/api/sos/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sharingToken })
      });
    } catch (err) {
      console.error('Failed to stop on server', err);
    } finally {
      setState('idle');
      setSharingToken(null);
      setNotifiedCount(0);
    }
  };

  return (
    <div className="w-full glass-card bg-[#1a0a0a]/80 text-gray-100 rounded-2xl shadow-[0_10px_30px_rgba(220,38,38,0.15)] border border-red-500/20 p-6 flex flex-col items-center relative overflow-hidden backdrop-blur-xl">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500/0 via-red-500/50 to-red-500/0"></div>
      
      <h3 className="font-bold text-[10px] tracking-widest uppercase text-red-400 mb-5 flex items-center gap-2">
        <span className="text-lg filter drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">🚨</span> Emergency SOS
      </h3>

      {state === 'idle' && (
        <div className="w-full flex flex-col gap-3">
          <button 
            onClick={handleStart}
            className="w-full py-4 glass-button bg-red-600/80 hover:bg-red-500 text-white rounded-xl font-bold shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:shadow-[0_0_30px_rgba(220,38,38,0.6)] transition-all border border-red-400/50 uppercase tracking-wider text-sm flex items-center justify-center gap-2"
          >
            SOS — Send Alert
          </button>
          
          <a href="tel:112" className="w-full py-3 glass-button bg-blue-600/40 hover:bg-blue-500/60 text-white rounded-xl font-bold border border-blue-400/50 text-xs flex justify-center items-center uppercase tracking-widest transition-all">
            📞 Dial 112 Directly
          </a>
        </div>
      )}

      {state === 'confirm' && (
        <div className="w-full flex flex-col items-center text-center animate-fade-in">
          <p className="text-sm font-bold tracking-wide mb-2 text-white drop-shadow-sm">Send Emergency Alert?</p>
          <p className="text-xs text-red-300 mb-4 glass-panel bg-red-950/40 p-3.5 rounded-xl border border-red-500/20 shadow-inner">
            This will share your live GPS location with your registered Telegram contacts and place automated voice calls to your saved phone numbers.
          </p>
          <div className="flex gap-3 w-full">
            <button 
              onClick={handleCancel}
              className="flex-1 py-3 glass-button bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-bold transition-all text-xs uppercase tracking-wider"
            >
              Cancel
            </button>
            <button 
              onClick={handleConfirm}
              className="flex-1 py-3 glass-button bg-red-600/80 hover:bg-red-500 text-white rounded-xl font-black shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all border border-red-400/50 text-xs uppercase tracking-wider"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {state === 'countdown' && (
        <div className="w-full flex flex-col items-center text-center animate-fade-in">
          <p className="text-[10px] tracking-widest uppercase mb-2 font-bold text-red-400">SOS countdown started</p>
          <div className="relative flex items-center justify-center w-24 h-24 mb-5">
            <div className="absolute inset-0 border-4 border-red-500/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-red-500 rounded-full border-t-transparent animate-spin" style={{ animationDuration: '2s' }}></div>
            <p className="text-5xl font-black font-mono text-white drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]">{countdown}</p>
          </div>
          <button 
            onClick={handleCancel}
            className="w-full py-3.5 glass-button bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold border border-white/10 transition-all text-sm uppercase tracking-wider"
          >
            Cancel SOS
          </button>
        </div>
      )}

      {state === 'dispatching' && (
        <div className="text-sm font-bold text-red-400 animate-pulse">Contacting Dispatch...</div>
      )}

      {state === 'error' && (
        <div className="w-full text-center">
          <div className="text-red-400 text-xs mb-4 bg-red-950/50 p-3 rounded-lg border border-red-500/30">
            {error}
          </div>
          <button 
            onClick={() => setState('idle')}
            className="w-full py-2 glass-button bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold border border-white/10 text-xs"
          >
            Go Back
          </button>
          <a href="tel:112" className="mt-3 block w-full py-3 glass-button bg-blue-600/80 hover:bg-blue-500 text-white rounded-xl font-bold border border-blue-400/50 text-sm">
            Call 112 (India)
          </a>
        </div>
      )}

      {state === 'active' && (
        <div className="w-full flex flex-col gap-4 animate-slide-up">
          <div className="text-xs font-bold tracking-wide glass-panel bg-red-950/40 p-4 rounded-xl border border-red-500/30 shadow-inner flex flex-col gap-3">
            <div className="flex justify-between items-center pb-2 border-b border-red-500/20">
              <span className="text-red-400 uppercase tracking-widest text-[10px]">SOS Active</span>
              <span className="flex items-center gap-1 text-[10px] text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>Live</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Total Alerts Sent</span>
              <span className="text-white font-mono">{notifiedCount}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-400">GPS Status</span>
              <span className={currentLocation ? 'text-green-400' : 'text-yellow-400'}>
                {currentLocation ? 'Updating...' : 'Waiting...'}
              </span>
            </div>
          </div>
          
          <button 
            onClick={handleStopSOS}
            className="w-full py-3.5 glass-button bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-all animate-fade-in border border-white/10 text-sm uppercase tracking-wider"
          >
            Mark As Safe (Stop)
          </button>
        </div>
      )}
      
      {state === 'stopping' && (
        <div className="text-sm text-gray-400 animate-pulse">Ending SOS session...</div>
      )}
    </div>
  );
}
