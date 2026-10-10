import React from 'react';
import { useCommunityReportsStore } from '../state/useCommunityReportsStore.js';

export default function ReportIssueControl() {
  const { isCreatingReport, setIsCreatingReport, setReportCreationLocation } = useCommunityReportsStore();

  if (isCreatingReport) return null;

  return (
    <button 
      onClick={() => {
        setIsCreatingReport(true);
        setReportCreationLocation(null);
      }}
      className="absolute bottom-8 right-8 premium-button text-[var(--color-sr-text-primary)] font-bold py-3.5 px-6 rounded-full shadow-lg flex items-center gap-2.5 transition-all hover:scale-105 z-40"
      aria-label="Report Road Issue"
    >
      <svg className="w-5 h-5 text-[var(--color-sr-accent)] drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
      <span className="tracking-wide">Report Issue</span>
    </button>
  );
}
