import { create } from 'zustand';

export const useStore = create((set) => ({
  origin: null,
  destination: null,
  travelTime: new Date(),
  mode: 'driving',
  
  routes: [],
  refuges: [],
  fastestRoute: null,
  saferRoute: null,
  riskCoverageAvailable: true,
  activeRouteId: null,
  currentLifelinePos: null,
  
  status: 'idle', // idle, loading, ready, error
  error: null,
  
  setOrigin: (origin) => set({ origin }),
  setDestination: (destination) => set({ destination }),
  setTravelTime: (travelTime) => set({ travelTime }),
  setMode: (mode) => set({ mode }),
  
  setStatus: (status, error = null) => set({ status, error }),
  setRefuges: (refuges) => set({ refuges }),
  
  setResults: (result) => set({ 
    routes: result.routes,
    fastestRoute: result.fastestRoute,
    safestRoute: result.safestRoute,
    riskCoverageAvailable: result.riskCoverageAvailable !== false,
    activeRouteId: result.safestRoute ? result.safestRoute.id : null,
    status: 'ready',
    error: null
  }),
  
  setActiveRouteId: (activeRouteId) => set({ activeRouteId }),
  setCurrentLifelinePos: (pos) => set({ currentLifelinePos: pos }),
  
  // Overlay State
  showZones: true,
  setShowZones: (showZones) => set({ showZones }),
  showRefuges: true,
  setShowRefuges: (showRefuges) => set({ showRefuges }),

  overlayRefuges: {}, // dictionary of id -> POI object
  overlayFilters: {
    pharmacy: true,
    hospital: true,
    police: true,
    petrol: true
  },
  addOverlayRefuges: (pois) => set((state) => {
    const nextRefuges = { ...state.overlayRefuges };
    let changed = false;
    for (const poi of pois) {
      if (!nextRefuges[poi.id]) {
        nextRefuges[poi.id] = poi;
        changed = true;
      }
    }
    return changed ? { overlayRefuges: nextRefuges } : state;
  }),
  setOverlayFilter: (category, value) => set((state) => ({
    overlayFilters: { ...state.overlayFilters, [category]: value }
  })),
  
  // Map Configuration
  mapStyle: 'mapbox://styles/mapbox/dark-v11',
  showTraffic: false,
  showTerrain: false,
  showTransit: false,
  setMapStyle: (style) => set({ mapStyle: style }),
  setShowTraffic: (show) => set({ showTraffic: show }),
  setShowTerrain: (show) => set({ showTerrain: show }),
  setShowTransit: (show) => set({ showTransit: show }),
  
  // Measurement Tool
  isMeasuring: false,
  measurementPoints: [], // Array of [lng, lat]
  setIsMeasuring: (isMeasuring) => set((state) => ({ isMeasuring, measurementPoints: isMeasuring ? [] : state.measurementPoints })),
  addMeasurementPoint: (point) => set((state) => ({ measurementPoints: [...state.measurementPoints, point] })),
  clearMeasurementPoints: () => set({ measurementPoints: [] }),
  
  // Navigation State
  isNavigating: false,
  isSOSActive: false, // track if SOS is active globally
  currentLocation: null, // [longitude, latitude]
  gpsAccuracy: null, // meters
  gpsHeading: null, // degrees
  gpsStatus: 'idle', // idle, locating, live, weak, error
  navigationError: null,
  isFollowing: true, // whether map camera auto-follows user
  
  setIsNavigating: (isNavigating) => set({ isNavigating }),
  setIsSOSActive: (isSOSActive) => set({ isSOSActive }),
  setCurrentLocation: (loc, accuracy = null, heading = null) => set({ currentLocation: loc, gpsAccuracy: accuracy, gpsHeading: heading }),
  setGpsStatus: (status, error = null) => set({ gpsStatus: status, navigationError: error }),
  setIsFollowing: (isFollowing) => set({ isFollowing }),
  endNavigation: () => set({ 
    isNavigating: false, 
    // Do NOT clear isSOSActive on endNavigation, SOS might still be running!
    currentLocation: null, 
    gpsAccuracy: null, 
    gpsHeading: null, 
    gpsStatus: 'idle', 
    navigationError: null, 
    isFollowing: true 
  }),
}));
