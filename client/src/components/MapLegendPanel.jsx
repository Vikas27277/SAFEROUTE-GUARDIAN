import React from 'react';
import { useStore } from '../state/useStore.js';

export default function MapLegendPanel() {
  const showZones = useStore(state => state.showZones);
  const setShowZones = useStore(state => state.setShowZones);
  const showRefuges = useStore(state => state.showRefuges);
  const setShowRefuges = useStore(state => state.setShowRefuges);
  const overlayFilters = useStore(state => state.overlayFilters);
  const setOverlayFilter = useStore(state => state.setOverlayFilter);

  return (
    <div className="flex flex-col gap-4">
      {/* Risk Zone Toggle & Legend */}
      <div className="glass-panel p-5 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-[var(--color-sr-border)] animate-fade-in">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold tracking-widest text-[10px] uppercase text-[var(--color-sr-text-secondary)] flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-[var(--color-sr-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
            Risk Zones
          </h3>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={showZones} 
              onChange={() => setShowZones(!showZones)} 
            />
            <div className="w-8 h-4 bg-[var(--color-sr-text-muted)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[var(--color-sr-accent)] shadow-inner"></div>
          </label>
        </div>
        
        <div className="space-y-3.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-sr-text-secondary)]">
          <div className="flex items-center group">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] mr-3"></span>
            <span className="text-[var(--color-sr-text-primary)]">High Risk <span className="text-[var(--color-sr-text-secondary)] ml-1 font-normal capitalize">(Red)</span></span>
          </div>
          <div className="flex items-center group">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)] mr-3"></span>
            <span className="text-[var(--color-sr-text-primary)]">Moderate <span className="text-[var(--color-sr-text-secondary)] ml-1 font-normal capitalize">(Yellow)</span></span>
          </div>
          <div className="flex items-center group">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] mr-3"></span>
            <span className="text-[var(--color-sr-text-primary)]">Lower Risk <span className="text-[var(--color-sr-text-secondary)] ml-1 font-normal capitalize">(Green)</span></span>
          </div>
        </div>
      </div>

      {/* Lifeline Refuges Toggle & Legend */}
      <div className="glass-panel p-5 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-[var(--color-sr-border)] animate-fade-in delay-75">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold tracking-widest text-[10px] uppercase text-[var(--color-sr-text-secondary)] flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-[var(--color-sr-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            Lifelines
          </h3>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={showRefuges} 
              onChange={() => setShowRefuges(!showRefuges)} 
            />
            <div className="w-8 h-4 bg-[var(--color-sr-text-muted)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[var(--color-sr-accent)] shadow-inner"></div>
          </label>
        </div>
        
        <div className="space-y-3.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-sr-text-secondary)]">
          <div className="flex items-center justify-between group">
            <div className="flex items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] mr-3 border border-emerald-400/50"></span>
              <span className="text-[var(--color-sr-text-primary)]">Pharmacy</span>
            </div>
            <input type="checkbox" checked={overlayFilters.pharmacy} onChange={(e) => setOverlayFilter('pharmacy', e.target.checked)} className="accent-[var(--color-sr-accent)]" />
          </div>
          <div className="flex items-center justify-between group">
            <div className="flex items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] mr-3 border border-red-400/50"></span>
              <span className="text-[var(--color-sr-text-primary)]">Hospital</span>
            </div>
            <input type="checkbox" checked={overlayFilters.hospital} onChange={(e) => setOverlayFilter('hospital', e.target.checked)} className="accent-[var(--color-sr-accent)]" />
          </div>
          <div className="flex items-center justify-between group">
            <div className="flex items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] mr-3 border border-blue-400/50"></span>
              <span className="text-[var(--color-sr-text-primary)]">Police</span>
            </div>
            <input type="checkbox" checked={overlayFilters.police} onChange={(e) => setOverlayFilter('police', e.target.checked)} className="accent-[var(--color-sr-accent)]" />
          </div>
          <div className="flex items-center justify-between group">
            <div className="flex items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] mr-3 border border-amber-400/50"></span>
              <span className="text-[var(--color-sr-text-primary)]">Petrol</span>
            </div>
            <input type="checkbox" checked={overlayFilters.petrol} onChange={(e) => setOverlayFilter('petrol', e.target.checked)} className="accent-[var(--color-sr-accent)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
