import { create } from 'zustand';
import { getPublicReports } from '../lib/publicReportService.js';

export const useCommunityReportsStore = create((set, get) => ({
  reports: [],
  selectedReportId: null,
  isCreatingReport: false,
  reportCreationLocation: null,
  isLoading: false,
  error: null,

  fetchReports: async () => {
    set({ isLoading: true, error: null });
    try {
      const reports = await getPublicReports();
      set({ reports, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch public reports:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  setSelectedReportId: (id) => set({ selectedReportId: id }),
  setIsCreatingReport: (isCreating) => set({ isCreatingReport: isCreating }),
  setReportCreationLocation: (location) => set({ reportCreationLocation: location }),
  
  refreshReports: () => {
    get().fetchReports();
  }
}));
