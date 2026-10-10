import { db } from './firebase.js';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { supabase } from './supabase.js';
import { getCurrentUserId } from '../state/useAuthStore.js';
import { REPORT_CATEGORIES, REPORT_STATUS } from '../../../shared/communityReports.js';
import { DEFAULT_CONFIG } from '../../../shared/scoringConfig.js';

/**
 * Validates a report payload against the configuration rules.
 */
export function validateReportPayload(payload) {
  const config = DEFAULT_CONFIG.communityReports;
  const errors = [];

  // 1. Authenticated user required
  if (!getCurrentUserId()) {
    errors.push('User must be authenticated to create a report.');
    // If not authenticated, we can return early
    return { isValid: false, errors };
  }

  // 2. Category validation
  if (!payload.category || !Object.values(REPORT_CATEGORIES).includes(payload.category)) {
    errors.push('Invalid or missing report category.');
  }

  // 3. Location validation
  if (!payload.location || !Array.isArray(payload.location.coordinates) || payload.location.coordinates.length !== 2) {
    errors.push('Invalid or missing location coordinates.');
  } else if (payload.location.type !== 'Point') {
    errors.push('Location type must be "Point".');
  }

  // 4. Description validation
  if (!payload.description || payload.description.trim().length === 0) {
    errors.push('Description is required.');
  } else if (payload.description.length > config.maxReportDescriptionLength) {
    errors.push(`Description exceeds the maximum length of ${config.maxReportDescriptionLength} characters.`);
  }

  // 5. Image validation (optional — 0 images is valid)
  if (payload.images && payload.images.length > 0) {
    if (payload.images.length > config.maxImagesPerReport) {
      errors.push(`Maximum of ${config.maxImagesPerReport} images allowed.`);
    } else {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      const maxSizeBytes = config.maxImageSizeMb * 1024 * 1024;
      
      payload.images.forEach((file, index) => {
        if (!validTypes.includes(file.type)) {
          errors.push(`Image ${index + 1} has an unsupported format. Supported formats: JPEG, PNG, WebP.`);
        }
        if (file.size > maxSizeBytes) {
          errors.push(`Image ${index + 1} exceeds the maximum size of ${config.maxImageSizeMb} MB.`);
        }
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Creates a new Guardian Report.
 * @param {Object} payload 
 * @param {string} payload.category
 * @param {string} payload.title
 * @param {string} payload.description
 * @param {Object} payload.location
 * @param {string} payload.location.type
 * @param {number[]} payload.location.coordinates
 * @param {File[]} payload.images
 * @returns {Promise<Object>} Created report object
 */
export async function createReport(payload) {
  const validation = validateReportPayload(payload);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(' '));
  }

  const config = DEFAULT_CONFIG.communityReports;
  const uid = getCurrentUserId();
  
  // Generate ID locally for structured upload paths
  const reportRef = doc(collection(db, 'reports'));
  const reportId = reportRef.id;

  // Upload images only if provided
  const imageUrls = [];
  const hasImages = payload.images && payload.images.length > 0;
  
  if (hasImages) {
    for (let i = 0; i < payload.images.length; i++) {
      const file = payload.images[i];
      const extension = file.name.split('.').pop() || 'jpg';
      const imagePath = `${reportId}/img_${i}_${Date.now()}.${extension}`;
      
      try {
        const { data, error } = await supabase.storage
          .from('reports')
          .upload(imagePath, file);
          
        if (error) throw error;
        
        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from('reports')
          .getPublicUrl(imagePath);
          
        imageUrls.push(publicUrlData.publicUrl);
      } catch (uploadError) {
        console.error(`Photo upload failed for ${file.name}:`, uploadError);
        // Re-throw with a user-friendly message that allows retrying or continuing without the photo
        throw new Error(`Photo upload failed for "${file.name}". You can retry or remove the photo and submit without it.`);
      }
    }
  }

  const reportDoc = {
    category: payload.category,
    title: payload.title,
    description: payload.description,
    location: {
      type: "Point",
      coordinates: payload.location.coordinates
    },
    imageUrls: imageUrls,
    severity: payload.severity || 'Medium',
    userId: uid,
    status: 'PENDING',
    upvotes: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(reportRef, reportDoc);

  return { id: reportId, ...reportDoc };
}
