import React, { useState, useEffect } from 'react';
import { useStore } from '../state/useStore';
import PlaceInput from './PlaceInput';
import { runAnalysis } from '../lib/pipeline';
import { DEFAULT_CONFIG } from '../../../shared/scoringConfig';

export default function SearchPanel() {
  const store = useStore();
  const [zones, setZones] = useState(null);

  useEffect(() => {
    fetch('/zones.bengaluru.geojson')
      .then(r => r.json())
      .then(z => setZones(z))
      .catch(console.error);
  }, []);

  const handleTimeClick = (hours, mins = 0) => {
    const d = new Date();
    d.setHours(hours, mins, 0, 0);
    store.setTravelTime(d);
  };

  const handleNowClick = () => {
    store.setTravelTime(new Date());
  };

  const handleLoadDemo = () => {
    store.setOrigin({ label: 'M G Road, Bengaluru', coords: [77.607421, 12.973413] });
    store.setDestination({ label: 'Indiranagar, Bengaluru', coords: [77.638708, 12.978281] });
    
    const demoDate = new Date();
    demoDate.setHours(22, 30, 0, 0); // 10:30 PM
    store.setTravelTime(demoDate);
    store.setMode('driving');
  };

  const handleSearch = async () => {
    const isValidCoordinate = coords => Array.isArray(coords) && coords.length === 2 &&
      Number.isFinite(coords[0]) && Number.isFinite(coords[1]) &&
      Math.abs(coords[0]) <= 180 && Math.abs(coords[1]) <= 90;

    if (!store.origin || !isValidCoordinate(store.origin.coords) || !store.destination || !isValidCoordinate(store.destination.coords)) {
      store.setStatus('error', 'Please select both origin and destination.');
      return;
    }
    if (store.origin.coords[0] === store.destination.coords[0] && store.origin.coords[1] === store.destination.coords[1]) {
      store.setStatus('error', 'Origin and destination cannot be the same.');
      return;
    }
    
    store.setStatus('loading');
    try {
      const isWithinRiskCoverage = coords => coords[0] > 77.4 && coords[0] < 77.8 && coords[1] > 12.8 && coords[1] < 13.2;
      const riskCoverageAvailable = Boolean(zones) && isWithinRiskCoverage(store.origin.coords) && isWithinRiskCoverage(store.destination.coords);
      const result = await runAnalysis({
        origin: store.origin.coords,
        destination: store.destination.coords,
        timeDate: store.travelTime,
        zones: zones || { type: 'FeatureCollection', features: [] },
        riskCoverageAvailable,
        mode: store.mode,
        config: DEFAULT_CONFIG,
        isDemo: window.location.search.includes('demo=1')
      });
      store.setResults(result);
    } catch (err) {
      store.setStatus('error', err.message);
    }
  };

  const formatDateTimeLocal = (date) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date - tzOffset)).toISOString().slice(0,16);
    return localISOTime;
  };

  const handleDateTimeChange = (e) => {
    if(e.target.value) {
      store.setTravelTime(new Date(e.target.value));
    }
  };

  return (
    <div className="flex flex-col text-[var(--color-sr-text-primary)] shrink-0 animate-fade-in">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-xl font-bold text-[var(--color-sr-text-primary)] tracking-tight flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--color-sr-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Trip Setup
        </h2>
        <button 
          onClick={handleLoadDemo}
          className="text-[10px] font-bold text-[var(--color-sr-text-muted)] hover:text-[var(--color-sr-text-primary)] transition-colors uppercase tracking-widest bg-[var(--color-sr-main)] hover:bg-[var(--color-sr-border)] px-2.5 py-1.5 rounded border border-[var(--color-sr-border)] shadow-sm"
        >
          Load Demo
        </button>
      </div>

      <div className="space-y-5">
        <div className="relative">
          <label className="block text-[10px] font-semibold mb-1.5 text-sr-text-secondary uppercase tracking-widest">Starting Point</label>
          <PlaceInput 
            placeholder="Enter origin..." 
            value={store.origin} 
            onChange={store.setOrigin} 
          />
        </div>

        <div className="relative">
          <label className="block text-[10px] font-semibold mb-1.5 text-sr-text-secondary uppercase tracking-widest">Destination</label>
          <PlaceInput 
            placeholder="Enter destination..." 
            value={store.destination} 
            onChange={store.setDestination} 
          />
        </div>
        
        <div>
          <label className="block text-[10px] font-semibold mb-1.5 text-sr-text-secondary uppercase tracking-widest">Travel Time</label>
          <input 
            type="datetime-local" 
            className="w-full p-3 rounded-xl premium-input text-sm"
            value={formatDateTimeLocal(store.travelTime)}
            onChange={handleDateTimeChange}
            style={{ colorScheme: 'dark' }}
          />
          <div className="flex flex-wrap gap-2 mt-3">
            <button className="flex-1 py-2 bg-[var(--color-sr-elevated)] hover:bg-[var(--color-sr-border)] text-[var(--color-sr-text-secondary)] rounded-lg text-xs font-medium transition-colors border border-[var(--color-sr-border)]" onClick={handleNowClick}>Now</button>
            <button className="flex-1 py-2 bg-[var(--color-sr-elevated)] hover:bg-[var(--color-sr-border)] text-[var(--color-sr-text-secondary)] rounded-lg text-xs font-medium transition-colors border border-[var(--color-sr-border)]" onClick={() => handleTimeClick(14)}>2 PM</button>
            <button className="flex-1 py-2 bg-[var(--color-sr-elevated)] hover:bg-[var(--color-sr-border)] text-[var(--color-sr-text-secondary)] rounded-lg text-xs font-medium transition-colors border border-[var(--color-sr-border)]" onClick={() => handleTimeClick(21)}>9 PM</button>
            <button className="flex-1 py-2 bg-[var(--color-sr-elevated)] hover:bg-[var(--color-sr-border)] text-[var(--color-sr-text-secondary)] rounded-lg text-xs font-medium transition-colors border border-[var(--color-sr-border)]" onClick={() => handleTimeClick(23)}>11 PM</button>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold mb-1.5 text-sr-text-secondary uppercase tracking-widest">Mode</label>
          <div className="flex gap-1.5">
            <button 
              className={`flex-1 p-2 rounded-lg text-xs font-medium border transition-all ${store.mode === 'driving' ? 'bg-[var(--color-sr-elevated)] border-[var(--color-sr-accent)] text-[var(--color-sr-text-primary)] shadow-sm' : 'bg-[var(--color-sr-main)] border-[var(--color-sr-border)] text-[var(--color-sr-text-muted)] hover:bg-[var(--color-sr-elevated)]'}`}
              onClick={() => store.setMode('driving')}
            >
              🚗 Drive
            </button>
            <button 
              className={`flex-1 p-2 rounded-lg text-xs font-medium border transition-all ${store.mode === 'cycling' ? 'bg-[var(--color-sr-elevated)] border-[var(--color-sr-accent)] text-[var(--color-sr-text-primary)] shadow-sm' : 'bg-[var(--color-sr-main)] border-[var(--color-sr-border)] text-[var(--color-sr-text-muted)] hover:bg-[var(--color-sr-elevated)]'}`}
              onClick={() => store.setMode('cycling')}
            >
              🚲 Cycle
            </button>
            <button 
              className={`flex-1 p-2 rounded-lg text-xs font-medium border transition-all ${store.mode === 'walking' ? 'bg-[var(--color-sr-elevated)] border-[var(--color-sr-accent)] text-[var(--color-sr-text-primary)] shadow-sm' : 'bg-[var(--color-sr-main)] border-[var(--color-sr-border)] text-[var(--color-sr-text-muted)] hover:bg-[var(--color-sr-elevated)]'}`}
              onClick={() => store.setMode('walking')}
            >
              🚶 Walk
            </button>
            <button 
              className="flex-1 p-2 rounded-lg text-xs font-medium border bg-[var(--color-sr-main)] border-[var(--color-sr-border)] text-[var(--color-sr-text-muted)] opacity-50 cursor-not-allowed"
              title="Requires Transit API Provider"
              disabled
            >
              🚌 Transit
            </button>
          </div>
        </div>

        <button 
          onClick={handleSearch}
          disabled={store.status === 'loading'}
          className="w-full mt-4 p-4 premium-button rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {store.status === 'loading' ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-[var(--color-sr-text-secondary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-[var(--color-sr-text-secondary)]">Analyzing Routes...</span>
            </>
          ) : 'Find Safer Route'}
        </button>

        {store.error && (
          <div className="p-3 bg-red-950/50 border border-red-500/50 text-red-400 rounded-lg text-sm flex items-start gap-2">
            <span>⚠️</span>
            <span>{store.error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
