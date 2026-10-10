import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../state/useAuthStore';
import { useCommunityReportsStore } from '../state/useCommunityReportsStore';
import AuthPanel from './AuthPanel';
import { REPORT_STATUS, VOTE_TYPES } from '../../../shared/communityReports';
import { supabase } from '../lib/supabase';

export default function CommunityDashboard() {
  const { currentUser, isAuthenticated, role } = useAuthStore();
  const { reports, fetchReports, setSelectedReportId } = useCommunityReportsStore();
  
  const [activeTab, setActiveTab] = useState('auth'); // 'auth', 'myReports', 'voting'

  useEffect(() => {
    if (isAuthenticated) {
      setActiveTab('myReports');
      fetchReports();
    } else {
      setActiveTab('auth');
    }
  }, [isAuthenticated, fetchReports]);

  const handleVote = async (reportId, voteType) => {
    try {
      if (!currentUser) throw new Error("Not authenticated");
      const token = await currentUser.getIdToken();
      
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/reports/${reportId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ vote: voteType })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cast vote');
      }
      alert('Vote cast successfully!');
      fetchReports();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleModerate = async (reportId, decision) => {
    try {
      if (!currentUser) throw new Error("Not authenticated");
      const token = await currentUser.getIdToken();
      
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/reports/${reportId}/moderate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ decision })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to moderate');
      }
      alert('Moderated successfully!');
      fetchReports();
    } catch (err) {
      alert(err.message);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col h-full overflow-y-auto custom-scrollbar pr-2 animate-fade-in">
        <h2 className="text-xl font-black text-white mb-6 drop-shadow-sm tracking-wide">Community</h2>
        <AuthPanel />
      </div>
    );
  }

  const myReports = reports.filter(r => r.createdBy === currentUser.uid);
  const eligibleReports = reports.filter(r => r.status === REPORT_STATUS.PENDING || r.status === REPORT_STATUS.DISPUTED);
  
  // Exclude user's own reports from voting
  const votingReports = eligibleReports.filter(r => r.createdBy !== currentUser.uid);

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar pr-2 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-[var(--color-sr-text-primary)] drop-shadow-sm tracking-wide">Community</h2>
        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-sr-accent-light)] bg-[var(--color-sr-elevated)] px-3 py-1 rounded-full border border-[var(--color-sr-border)]">
          {currentUser.email} {role === 'moderator' ? '(Mod)' : ''}
        </div>
      </div>

      <div className="flex border-b border-[var(--color-sr-border)] mb-6 bg-[var(--color-sr-secondary)] p-1 rounded-xl glass-card relative">
        <button 
          className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === 'myReports' ? 'bg-[var(--color-sr-elevated)] text-[var(--color-sr-text-primary)] shadow-sm border border-[var(--color-sr-border)]' : 'text-[var(--color-sr-text-secondary)] hover:text-[var(--color-sr-text-primary)] hover:bg-[var(--color-sr-elevated)] border border-transparent'}`}
          onClick={() => setActiveTab('myReports')}
        >
          My Reports ({myReports.length})
        </button>
        <button 
          className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === 'voting' ? 'bg-[var(--color-sr-elevated)] text-[var(--color-sr-text-primary)] shadow-sm border border-[var(--color-sr-border)]' : 'text-[var(--color-sr-text-secondary)] hover:text-[var(--color-sr-text-primary)] hover:bg-[var(--color-sr-elevated)] border border-transparent'}`}
          onClick={() => setActiveTab('voting')}
        >
          Voting ({votingReports.length})
        </button>
        <button 
          className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === 'auth' ? 'bg-[var(--color-sr-elevated)] text-[var(--color-sr-text-primary)] shadow-sm border border-[var(--color-sr-border)]' : 'text-[var(--color-sr-text-secondary)] hover:text-[var(--color-sr-text-primary)] hover:bg-[var(--color-sr-elevated)] border border-transparent'}`}
          onClick={() => setActiveTab('auth')}
        >
          Account
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'auth' && <AuthPanel />}

        {activeTab === 'myReports' && (
          <div className="space-y-4 animate-slide-up">
            {myReports.length === 0 ? (
              <p className="text-[11px] text-[var(--color-sr-text-secondary)] font-bold uppercase tracking-wider text-center py-8 glass-panel rounded-xl">You haven't submitted any reports yet.</p>
            ) : (
              myReports.map(report => (
                <div key={report.id} className="glass-panel p-4 rounded-2xl cursor-pointer hover:border-[var(--color-sr-border-strong)] transition-all shadow-lg" onClick={() => setSelectedReportId(report.id)}>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-[var(--color-sr-text-primary)] text-sm drop-shadow-sm">{report.title}</h4>
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-[var(--color-sr-elevated)] text-[var(--color-sr-text-secondary)] border border-[var(--color-sr-border)]">{report.status}</span>
                  </div>
                  <p className="text-xs text-[var(--color-sr-text-secondary)] mb-4 truncate">{report.description}</p>
                  <div className="flex gap-4 text-xs font-bold text-[var(--color-sr-text-muted)]">
                    <span className="flex items-center gap-1.5"><span className="text-emerald-400">👍</span> {report.community?.confirmCount || 0}</span>
                    <span className="flex items-center gap-1.5"><span className="text-red-400">👎</span> {report.community?.inaccurateCount || 0}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'voting' && (
          <div className="space-y-4 animate-slide-up">
            {votingReports.length === 0 ? (
              <p className="text-[11px] text-[var(--color-sr-text-secondary)] font-bold uppercase tracking-wider text-center py-8 glass-panel rounded-xl">No reports currently need verification.</p>
            ) : (
              votingReports.map(report => (
                <div key={report.id} className="glass-panel p-4 rounded-2xl shadow-lg">
                  <div className="flex justify-between items-start mb-2 cursor-pointer group" onClick={() => setSelectedReportId(report.id)}>
                    <h4 className="font-bold text-[var(--color-sr-text-primary)] text-sm group-hover:text-[var(--color-sr-accent-light)] transition-colors drop-shadow-sm">{report.title}</h4>
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-[var(--color-sr-main)] text-[var(--color-sr-accent)] border border-[var(--color-sr-border)]">{report.category}</span>
                  </div>
                  <p className="text-xs text-[var(--color-sr-text-secondary)] mb-5 leading-relaxed">{report.description}</p>
                  
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleVote(report.id, VOTE_TYPES.CONFIRM)}
                      className="flex-1 premium-button text-emerald-400 text-xs font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      Confirm <span className="text-sm">👍</span>
                    </button>
                    <button 
                      onClick={() => handleVote(report.id, VOTE_TYPES.INACCURATE)}
                      className="flex-1 premium-button text-red-400 text-xs font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      Inaccurate <span className="text-sm">👎</span>
                    </button>
                  </div>
                  
                  {role === 'moderator' && (
                    <div className="mt-4 pt-3 border-t border-[var(--color-sr-border)] flex gap-3 items-center">
                      <span className="text-[9px] text-[var(--color-sr-text-secondary)] font-black uppercase tracking-widest flex items-center bg-[var(--color-sr-secondary)] px-2 py-1 rounded">Mod:</span>
                      <button 
                        onClick={() => handleModerate(report.id, 'verify')}
                        className="flex-1 premium-button text-emerald-300 text-[10px] font-bold uppercase tracking-wider py-1.5 rounded-lg transition-all"
                      >
                        Verify
                      </button>
                      <button 
                        onClick={() => handleModerate(report.id, 'reject')}
                        className="flex-1 premium-button text-red-300 text-[10px] font-bold uppercase tracking-wider py-1.5 rounded-lg transition-all"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
