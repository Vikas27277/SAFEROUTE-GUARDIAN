import { useEffect, useRef } from 'react';
import { useStore } from '../state/useStore';

export function useGeolocation() {
  const isNavigating = useStore(state => state.isNavigating);
  const isSOSActive = useStore(state => state.isSOSActive);
  const setCurrentLocation = useStore(state => state.setCurrentLocation);
  const setGpsStatus = useStore(state => state.setGpsStatus);
  const watchIdRef = useRef(null);

  useEffect(() => {
    // If we're not navigating AND not in an SOS, make sure we clean up and don't watch
    if (!isNavigating && !isSOSActive) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      setGpsStatus('error', 'Geolocation is not supported by your browser.');
      return;
    }

    setGpsStatus('locating');

    const handleSuccess = (position) => {
      const { longitude, latitude, accuracy, heading } = position.coords;
      setCurrentLocation([longitude, latitude], accuracy, heading);
      
      if (accuracy > 50) {
        setGpsStatus('weak');
      } else {
        setGpsStatus('live');
      }
    };

    const handleError = (error) => {
      console.warn('Geolocation error:', error);
      let errorMessage = 'Failed to get location.';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Location permission denied. Please enable GPS.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Location information is unavailable.';
          break;
        case error.TIMEOUT:
          errorMessage = 'The request to get user location timed out.';
          break;
      }
      setGpsStatus('error', errorMessage);
    };

    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true, // Use GPS
      timeout: 10000,
      maximumAge: 0 // Do not use cached position
    });

    // Cleanup on unmount or when navigation ends
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isNavigating, isSOSActive, setCurrentLocation, setGpsStatus]);
}
