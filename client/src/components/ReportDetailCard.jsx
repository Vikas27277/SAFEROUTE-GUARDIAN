import React, { useState, useEffect } from 'react';
import { useCommunityReportsStore } from '../state/useCommunityReportsStore.js';
import { useAuthStore } from '../state/useAuthStore.js';
import { REPORT_STATUS, VOTE_TYPES } from '../../../shared/communityReports.js';
import { supabase } from '../lib/supabase.js';

export default function ReportDetailCard() {
  const { reports, selectedReportId, setSelectedReportId, refreshReports } = useCommunityReportsStore();
  const { currentUser } = useAuthStore();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isVoting, setIsVoting] = useState(false);
  const [voteError, setVoteError] = useState(null);

  const report = reports.find(r => r.id === selectedReportId);

  // Reset image index when report changes
  useEffect(() => {
    setCurrentImageIndex(0);
    setVoteError(null);
  }, [selectedReportId]);

  if (!report) return null;

  const handleClose = () => {
    setSelectedReportId(null);
  };

  const handleVote = async (isAccurate) => {
    if (!currentUser) {
      setVoteError('Authentication required to vote.');
      return;
    }

    setIsVoting(true);
    setVoteError(null);
    try {
      const token = await currentUser.getIdToken();

      const voteType = isAccurate ? VOTE_TYPES.CONFIRM : VOTE_TYPES.INACCURATE;
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/reports/${report.id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ vote: voteType })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit vote.');
      }
      
      await refreshReports(); // Refresh the list to get new counts
    } catch (err) {
      setVoteError(err.message || 'Failed to submit vote.');
    } finally {
      setIsVoting(false);
    }
  };

  const statusLabel = () => {
    switch (report.status) {
      case REPORT_STATUS.MODERATOR_VERIFIED:
        return <span className="bg-[var(--color-sr-secondary)] text-blue-400 px-2.5 py-1 rounded-md text-[10px] font-bold border border-[var(--color-sr-border)] uppercase tracking-wider">Moderator Verified</span>;
      case REPORT_STATUS.COMMUNITY_VERIFIED:
        return <span className="bg-[var(--color-sr-secondary)] text-emerald-400 px-2.5 py-1 rounded-md text-[10px] font-bold border border-[var(--color-sr-border)] uppercase tracking-wider">Community Verified</span>;
      case REPORT_STATUS.DISPUTED:
        return <span className="bg-[var(--color-sr-secondary)] text-red-400 px-2.5 py-1 rounded-md text-[10px] font-bold border border-[var(--color-sr-border)] uppercase tracking-wider">Community Disputed</span>;
      case REPORT_STATUS.PENDING:
      default:
        return <span className="bg-[var(--color-sr-secondary)] text-yellow-400 px-2.5 py-1 rounded-md text-[10px] font-bold border border-[var(--color-sr-border)] uppercase tracking-wider">Reported Issue</span>;
    }
  };

  const hasImages = report.imageUrls && report.imageUrls.length > 0;

  return (
    <div className="absolute top-24 right-6 w-80 glass-card bg-[var(--color-sr-main)]/90 text-[var(--color-sr-text-primary)] rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.6)] border border-[var(--color-sr-border)] z-50 overflow-hidden flex flex-col animate-slide-up">
      {/* Header */}
      <div className="flex justify-between items-start p-5 border-b border-[var(--color-sr-border)] bg-[var(--color-sr-secondary)] backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">⚠️</span>
            <h3 className="font-bold text-lg text-[var(--color-sr-text-primary)] capitalize tracking-wide">{report.category.replace('_', ' ')}</h3>
          </div>
          {statusLabel()}
        </div>
        <button 
          onClick={handleClose}
          className="text-[var(--color-sr-text-secondary)] hover:text-[var(--color-sr-text-primary)] p-1.5 rounded-full hover:bg-[var(--color-sr-elevated)] transition-colors border border-transparent hover:border-[var(--color-sr-border)]"
          aria-label="Close detail card"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {hasImages ? (
        <div className="relative w-full h-48 bg-black/80 flex items-center justify-center border-b border-[var(--color-sr-border)]">
          <img 
            src={report.imageUrls[currentImageIndex]} 
            alt="Report detail" 
            className="max-w-full max-h-full object-contain"
            onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex'; }}
          />
          <div className="hidden items-center justify-center w-full h-full text-[var(--color-sr-text-secondary)] text-sm">
            Image unavailable
          </div>
          {report.imageUrls.length > 1 && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2 bg-black/50 py-1.5 backdrop-blur-sm">
              {report.imageUrls.map((_, idx) => (
                <button 
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-colors ${idx === currentImageIndex ? 'bg-[var(--color-sr-accent-light)]' : 'bg-[var(--color-sr-text-muted)] hover:bg-[var(--color-sr-text-secondary)]'}`}
                  aria-label={`View image ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="w-full py-4 bg-[var(--color-sr-secondary)] flex items-center justify-center border-b border-[var(--color-sr-border)]">
          <span className="text-xs text-[var(--color-sr-text-secondary)] italic">No photo attached</span>
        </div>
      )}

      {/* Body */}
      <div className="p-5 flex-1 overflow-y-auto">
        <h4 className="font-bold text-[var(--color-sr-text-primary)] mb-2 text-base">{report.title}</h4>
        <p className="text-sm text-[var(--color-sr-text-secondary)] mb-5 leading-relaxed">{report.description}</p>
        
        <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider text-[var(--color-sr-text-secondary)] mb-5">
          <span>Reported: <span className="text-[var(--color-sr-text-primary)]">{report.reportedAt?.toDate ? report.reportedAt.toDate().toLocaleString() : 'Recently'}</span></span>
        </div>

        <div className="border-t border-[var(--color-sr-border)] pt-5">
          <p className="text-xs font-bold text-[var(--color-sr-text-primary)] mb-4 text-center uppercase tracking-wider">Is this report still accurate?</p>
          
          <div className="flex gap-3">
            <button 
              onClick={() => handleVote(true)}
              disabled={isVoting}
              className="flex-1 premium-button text-emerald-400 border border-emerald-500/20 rounded-xl py-2.5 flex flex-col items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="font-bold text-sm mb-0.5">Confirm</span>
              <span className="text-xs font-black bg-emerald-500/20 px-2 py-0.5 rounded-full">{report.community?.confirmCount || 0}</span>
            </button>
            <button 
              onClick={() => handleVote(false)}
              disabled={isVoting}
              className="flex-1 premium-button text-red-400 border border-red-500/20 rounded-xl py-2.5 flex flex-col items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="font-bold text-sm mb-0.5">Clear It</span>
              <span className="text-xs font-black bg-red-500/20 px-2 py-0.5 rounded-full">{report.community?.inaccurateCount || 0}</span>
            </button>
          </div>
          {voteError && (
            <p className="text-xs text-red-400 mt-3 text-center bg-[var(--color-sr-secondary)] border border-[var(--color-sr-border)] py-2 rounded-lg">{voteError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
