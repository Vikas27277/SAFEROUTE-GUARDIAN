import React, { useEffect, useState } from 'react';
import Header from './components/Header';
import MapCanvas from './components/MapCanvas';
import SearchPanel from './components/SearchPanel';
import RouteComparisonCard from './components/RouteComparisonCard';
import LifelineStrip from './components/LifelineStrip';
import CopilotPanel from './components/CopilotPanel';
import SOSControl from './components/SOSControl';
import TelegramSetup from './components/TelegramSetup';
import PhoneContactsSetup from './components/PhoneContactsSetup';
import ReportIssueControl from './components/ReportIssueControl';
import ReportIssueForm from './components/ReportIssueForm';
import ReportDetailCard from './components/ReportDetailCard';
import CommunityDashboard from './components/CommunityDashboard';
import MapLegendPanel from './components/MapLegendPanel';
import ActiveRoutePrompt from './components/ActiveRoutePrompt';
import NavigationHUD from './components/NavigationHUD';
import SecureLiveTracker from './components/SecureLiveTracker';
import MapControls from './components/MapControls';
import { useStore } from './state/useStore';
import { useAuthStore } from './state/useAuthStore';
import { useGeolocation } from './hooks/useGeolocation';
import IntroAnimation from './components/IntroAnimation';

function App() {
  const { origin, destination, routes, activeRouteId, isNavigating, mapStyle } = useStore();
  const [trackingToken, setTrackingToken] = useState(null);
  const [introFinished, setIntroFinished] = useState(false);

  // Parse URL for tracking token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const track = params.get('track');
    if (track) {
      setTrackingToken(track);
    }
  }, []);

  // Initialize GPS tracking if navigating
  useGeolocation();

  useEffect(() => {
    if (!import.meta.env.VITE_MAPBOX_TOKEN) {
      console.error('VITE_MAPBOX_TOKEN is missing!');
    }
    
    // Initialize Supabase Auth listener
    const unsubscribeAuth = useAuthStore.getState().initializeAuth();
    return () => unsubscribeAuth();
  }, []);

  // Render Secure Live Tracker if token is present
  if (trackingToken) {
    return <SecureLiveTracker trackingToken={trackingToken} />;
  }

  const isSatellite = mapStyle?.includes('satellite');

  return (
    <div className={`w-screen h-screen flex flex-col bg-[var(--color-sr-main)] text-[var(--color-sr-text-primary)] overflow-hidden font-sans transition-colors duration-500 ${isSatellite ? 'theme-satellite' : ''}`}>
      <Header onReplayIntro={() => {
        setIntroFinished(false);
      }} />
      
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* SIDEBAR - hidden during navigation */}
        <aside className={`w-full md:w-[420px] glass-panel border-r border-white/5 flex flex-col h-[50vh] md:h-full shrink-0 z-20 overflow-y-auto custom-scrollbar shadow-2xl transition-all duration-300 ${isNavigating ? 'hidden' : 'flex'}`}>
          <div className="p-5 flex flex-col gap-6 flex-1">
            <SearchPanel />
            <RouteComparisonCard />
            <LifelineStrip />
            <MapLegendPanel />
            
            {/* Moved up for higher visibility */}
            <div className="flex flex-col border border-white/5 rounded-lg glass-card p-4 gap-4">
              <TelegramSetup />
              <PhoneContactsSetup />
            </div>

            <div className="min-h-[250px] flex flex-col border border-white/5 rounded-lg glass-card p-4">
              <CommunityDashboard />
            </div>
            
            <div className="min-h-[300px] flex flex-col">
              <CopilotPanel />
            </div>
          </div>

          <div className="p-5 mt-auto border-t border-white/5 bg-[#0B0F12]/50">
            <SOSControl />
          </div>
        </aside>

        {/* Floating SOS Control during navigation */}
        {isNavigating && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-50">
            <SOSControl />
          </div>
        )}

        {/* MAIN MAP AREA */}
        <main className="flex-1 relative flex flex-col bg-black h-[50vh] md:h-full order-first md:order-last">
          <NavigationHUD />
          <MapControls />
          <MapCanvas 
            origin={origin?.coords} 
            destination={destination?.coords} 
            routes={routes} 
            activeRouteId={activeRouteId} 
          />
          {!isNavigating && (
            <>
              <ReportIssueControl />
              <ReportDetailCard />
              <ReportIssueForm />
              <ActiveRoutePrompt />
            </>
          )}
        </main>
      </div>

      {/* Premium Intro Animation */}
      {!introFinished && (
        <IntroAnimation 
          onComplete={() => {
            setIntroFinished(true);
          }} 
        />
      )}
    </div>
  );
}

export default App;
