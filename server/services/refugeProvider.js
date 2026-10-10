import { getLiveRefuges } from './providers/livePlacesProvider.js';
import { getSyntheticRefuges } from './providers/syntheticRefugeProvider.js';

export async function getRefuges({ routeGeometry, travelTime, mode } = {}) {
  try {
    // Attempt to use live provider if credentials exist
    if (process.env.LIVE_PLACES_API_KEY) {
      try {
        const liveData = await getLiveRefuges({ routeGeometry, travelTime, mode });
        if (liveData && liveData.features && liveData.features.length > 0) {
          return liveData;
        }
      } catch (liveError) {
        console.warn('Live places provider failed, falling back to synthetic data:', liveError.message);
      }
    }
    
    // Fallback to synthetic data
    return await getSyntheticRefuges();
  } catch (error) {
    console.error('Error in refugeProvider:', error);
    // Ultimate safe fallback
    return {
      type: "FeatureCollection",
      features: []
    };
  }
}
