import React, { useState, useEffect } from 'react';
import { useCommunityReportsStore } from '../state/useCommunityReportsStore.js';
import { useAuthStore } from '../state/useAuthStore.js';
import { createReport } from '../lib/reportService.js';
import { REPORT_CATEGORIES } from '../../../shared/communityReports.js';
import { DEFAULT_CONFIG } from '../../../shared/scoringConfig.js';

export default function ReportIssueForm() {
  const { isCreatingReport, setIsCreatingReport, reportCreationLocation, setReportCreationLocation, refreshReports } = useCommunityReportsStore();
  const { currentUser: user } = useAuthStore();
  
  const [category, setCategory] = useState(REPORT_CATEGORIES.OTHER);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('Medium');
  const [files, setFiles] = useState([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [submittedReport, setSubmittedReport] = useState(null);

  // Live checklist evaluation
  const isLocationValid = reportCreationLocation !== null;
  const isCategoryValid = Object.values(REPORT_CATEGORIES).includes(category);
  const isSeverityValid = ['Low', 'Medium', 'High'].includes(severity);
  const isDescriptionValid = description.trim().length > 0 && description.length <= DEFAULT_CONFIG.communityReports.maxReportDescriptionLength;
  // Photos are optional — valid when 0 or within the configured maximum
  const isPhotosValid = files.length <= DEFAULT_CONFIG.communityReports.maxImagesPerReport;
  const isReady = isLocationValid && isCategoryValid && isSeverityValid && isDescriptionValid && isPhotosValid && user;

  if (!isCreatingReport) return null;

  const handleClose = () => {
    setIsCreatingReport(false);
    setReportCreationLocation(null);
    setSuccess(false);
    setSubmittedReport(null);
    setError(null);
    setCategory(REPORT_CATEGORIES.OTHER);
    setTitle('');
    setDescription('');
    setSeverity('Medium');
    setFiles([]);
  };

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxBytes = DEFAULT_CONFIG.communityReports.maxImageSizeMb * 1024 * 1024;
    
    let currentFiles = [...files];
    let hasError = false;

    for (const file of selected) {
      if (!validTypes.includes(file.type)) {
        setError(`Unsupported format for ${file.name}. Supported formats: JPEG, PNG, WebP.`);
        hasError = true;
        break;
      }
      if (file.size > maxBytes) {
        setError(`Image ${file.name} exceeds the maximum size of ${DEFAULT_CONFIG.communityReports.maxImageSizeMb} MB.`);
        hasError = true;
        break;
      }
      currentFiles.push(file);
    }
    
    if (currentFiles.length > DEFAULT_CONFIG.communityReports.maxImagesPerReport) {
      setError(`Maximum ${DEFAULT_CONFIG.communityReports.maxImagesPerReport} images allowed.`);
      hasError = true;
    }

    if (!hasError) {
      setFiles(currentFiles);
      setError(null);
    }
  };

  const removeFile = (idx) => {
    setFiles(files.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isReady) {
      setError("Please complete all checklist items before submitting.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await createReport({
        category,
        severity,
        title,
        description,
        location: { type: 'Point', coordinates: reportCreationLocation },
        images: files
      });
      setSubmittedReport(response);
      setSuccess(true);
      await refreshReports();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success && submittedReport) {
    return (
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-[var(--color-sr-secondary)] text-[var(--color-sr-text-primary)] rounded-xl shadow-2xl border border-[var(--color-sr-border)] p-6 w-full max-w-sm text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-xl font-bold mb-2">Report Submitted</h2>
          <p className="text-[var(--color-sr-text-secondary)] mb-2 text-sm">
            Report ID: <span className="font-mono text-[var(--color-sr-text-primary)]">{submittedReport.id}</span>
          </p>
          <p className="text-[var(--color-sr-text-secondary)] mb-6 text-sm">
            Status: <span className="font-mono text-[var(--color-sr-accent-light)]">{submittedReport.status}</span>
          </p>
          <button 
            onClick={handleClose}
            className="w-full premium-button text-[var(--color-sr-text-primary)] font-bold py-3 px-4 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // If they clicked "Report Issue" but haven't selected a location yet
  if (!reportCreationLocation) {
    return (
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 glass-card bg-black/80 text-[var(--color-sr-text-primary)] px-8 py-4 rounded-full shadow-[0_15px_50px_rgba(0,0,0,0.6)] border border-[var(--color-sr-border)] z-50 flex items-center gap-6 animate-slide-up backdrop-blur-xl">
        <span className="font-bold tracking-wide flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--color-sr-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
          Drag map & tap to set location
        </span>
        <button onClick={handleClose} className="text-[var(--color-sr-text-secondary)] hover:text-[var(--color-sr-text-primary)] font-bold uppercase text-[10px] tracking-wider transition-colors bg-[var(--color-sr-elevated)] hover:bg-[var(--color-sr-border)] border border-[var(--color-sr-border)] px-3 py-1.5 rounded-full">Cancel</button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="glass-card bg-[var(--color-sr-main)]/90 text-[var(--color-sr-text-primary)] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] border border-[var(--color-sr-border)] w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        
        <div className="flex justify-between items-center p-6 border-b border-[var(--color-sr-border)] bg-[var(--color-sr-secondary)]">
          <h2 className="text-xl font-black text-[var(--color-sr-text-primary)] tracking-wide">Report Road Issue</h2>
          <button onClick={handleClose} disabled={isSubmitting} className="text-[var(--color-sr-text-secondary)] hover:text-[var(--color-sr-text-primary)] p-2 rounded-full hover:bg-[var(--color-sr-elevated)] transition-colors border border-transparent hover:border-[var(--color-sr-border)]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          <form id="report-form" onSubmit={handleSubmit} className="space-y-5">
            
            {error && (
              <div className="glass-panel bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm flex gap-3 items-start" role="alert">
                <span className="text-lg">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {!user && (
              <div className="glass-panel bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 p-4 rounded-xl text-sm flex gap-3 items-start mb-5">
                <span className="text-lg">🔒</span>
                <span>Authentication required. Please sign in before reporting.</span>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--color-sr-text-secondary)] mb-2">Category</label>
              <select 
                value={category} 
                onChange={(e) => setCategory(e.target.value)}
                className="w-full premium-input rounded-xl px-3 py-3 text-[var(--color-sr-text-primary)] capitalize appearance-none"
                required
              >
                {Object.values(REPORT_CATEGORIES).map(c => (
                  <option key={c} value={c}>{c.replace('_', ' ')}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--color-sr-text-secondary)] mb-2">Title</label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Large pothole in middle lane"
                className="w-full premium-input rounded-xl px-3 py-3 text-[var(--color-sr-text-primary)]"
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--color-sr-text-secondary)]">Description</label>
                <span className={`text-[10px] font-bold tracking-wider ${isDescriptionValid ? 'text-[var(--color-sr-text-secondary)]' : 'text-red-400'}`}>
                  {description.length}/{DEFAULT_CONFIG.communityReports.maxReportDescriptionLength}
                </span>
              </div>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional details..."
                className="w-full premium-input rounded-xl px-3 py-3 text-[var(--color-sr-text-primary)] h-28 resize-none"
                maxLength={DEFAULT_CONFIG.communityReports.maxReportDescriptionLength}
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--color-sr-text-secondary)] mb-2">Severity</label>
              <select 
                value={severity} 
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full premium-input rounded-xl px-3 py-3 text-[var(--color-sr-text-primary)] appearance-none"
                required
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>

            <div>
              <label htmlFor="photos-input" className="block text-[10px] font-bold uppercase tracking-wider text-[var(--color-sr-text-secondary)] mb-1">
                Photo (optional, max {DEFAULT_CONFIG.communityReports.maxImagesPerReport})
              </label>
              <p className="text-[10px] text-[var(--color-sr-text-muted)] mb-3 italic">You can submit a report without a photo.</p>
              
              {files.length > 0 && (
                <div className="flex gap-3 mb-3 flex-wrap">
                  {files.map((file, idx) => (
                    <div key={idx} className="relative w-20 h-20 bg-black/60 rounded-xl overflow-hidden border border-[var(--color-sr-border)] shadow-inner group">
                      <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
                      <button 
                        type="button" 
                        onClick={() => removeFile(idx)}
                        className="absolute inset-0 m-auto w-8 h-8 bg-red-500/80 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform scale-75 group-hover:scale-100 shadow-lg backdrop-blur-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {files.length < DEFAULT_CONFIG.communityReports.maxImagesPerReport && (
                <div className="relative">
                  <input 
                    id="photos-input"
                    type="file" 
                    accept="image/jpeg, image/png, image/webp" 
                    multiple 
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="w-full border-2 border-dashed border-[var(--color-sr-border-strong)] rounded-xl p-4 flex flex-col items-center justify-center text-[var(--color-sr-text-secondary)] bg-[var(--color-sr-secondary)] hover:bg-[var(--color-sr-elevated)] transition-colors">
                    <svg className="w-6 h-6 mb-2 text-[var(--color-sr-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    <span className="text-xs font-bold">Tap to upload photos</span>
                  </div>
                </div>
              )}
            </div>

            <div className="glass-panel p-4 rounded-xl space-y-3 mt-6">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-sr-text-secondary)]">Live Submission Checklist</h3>
              <ul className="space-y-2 text-xs font-medium">
                <li className={`flex items-center gap-3 ${isLocationValid ? 'text-emerald-400' : 'text-yellow-500'}`} data-testid="check-location">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${isLocationValid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-500'}`}>
                    {isLocationValid ? '✓' : '!'}
                  </span> 
                  Location selected {isLocationValid && <span className="text-sr-text-secondary ml-1">({reportCreationLocation[0].toFixed(4)}, {reportCreationLocation[1].toFixed(4)})</span>}
                </li>
                <li className={`flex items-center gap-3 ${isCategoryValid ? 'text-emerald-400' : 'text-red-400'}`} data-testid="check-category">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${isCategoryValid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {isCategoryValid ? '✓' : '✕'}
                  </span> 
                  Category selected
                </li>
                <li className={`flex items-center gap-3 ${isSeverityValid ? 'text-emerald-400' : 'text-red-400'}`} data-testid="check-severity">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${isSeverityValid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {isSeverityValid ? '✓' : '✕'}
                  </span> 
                  Severity selected
                </li>
                <li className={`flex items-center gap-3 ${isDescriptionValid ? 'text-emerald-400' : 'text-red-400'}`} data-testid="check-description">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${isDescriptionValid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {isDescriptionValid ? '✓' : '✕'}
                  </span> 
                  Description valid
                </li>
                <li className={`flex items-center gap-3 ${isPhotosValid ? 'text-emerald-400' : 'text-red-400'}`} data-testid="check-photos">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${isPhotosValid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {isPhotosValid ? '✓' : '✕'}
                  </span> 
                  Photos {files.length > 0 ? `(${files.length} selected)` : '(optional)'}
                </li>
              </ul>
            </div>

          </form>
        </div>

        <div className="p-5 border-t border-[var(--color-sr-border)] bg-[var(--color-sr-secondary)] flex justify-end gap-3 backdrop-blur-md">
          <button 
            type="button" 
            onClick={handleClose} 
            disabled={isSubmitting}
            className="px-5 py-2.5 text-[var(--color-sr-text-secondary)] hover:text-[var(--color-sr-text-primary)] font-bold text-sm transition-colors rounded-xl border border-transparent hover:border-[var(--color-sr-border)] hover:bg-[var(--color-sr-elevated)]"
          >
            Cancel
          </button>
          <button 
            form="report-form"
            type="submit" 
            disabled={isSubmitting || !isReady}
            className="px-6 py-2.5 premium-button font-bold rounded-xl flex items-center justify-center min-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
          >
            {isSubmitting ? (
              <span className="w-5 h-5 border-2 border-[var(--color-sr-text-secondary)] border-t-[var(--color-sr-text-primary)] rounded-full animate-spin"></span>
            ) : (
              'Submit Report'
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
