import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ReportIssueForm from './ReportIssueForm';
import { useCommunityReportsStore } from '../state/useCommunityReportsStore.js';
import { useAuthStore } from '../state/useAuthStore.js';
import { createReport } from '../lib/reportService.js';
import { REPORT_CATEGORIES } from '../../../shared/communityReports.js';
import { DEFAULT_CONFIG } from '../../../shared/scoringConfig.js';

// Mock the dependencies
vi.mock('../state/useCommunityReportsStore.js', () => ({
  useCommunityReportsStore: vi.fn(),
}));

vi.mock('../state/useAuthStore.js', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('../lib/reportService.js', () => ({
  createReport: vi.fn(),
}));

describe('ReportIssueForm Component', () => {
  let mockSetIsCreatingReport;
  let mockSetReportCreationLocation;
  let mockRefreshReports;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock URL.createObjectURL for testing image previews
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');

    mockSetIsCreatingReport = vi.fn();
    mockSetReportCreationLocation = vi.fn();
    mockRefreshReports = vi.fn().mockResolvedValue();

    useCommunityReportsStore.mockReturnValue({
      isCreatingReport: true,
      reportCreationLocation: [77.6, 12.9], // Valid location
      setIsCreatingReport: mockSetIsCreatingReport,
      setReportCreationLocation: mockSetReportCreationLocation,
      refreshReports: mockRefreshReports
    });

    useAuthStore.mockReturnValue({
      currentUser: { uid: 'user_123' }
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing if isCreatingReport is false', () => {
    useCommunityReportsStore.mockReturnValue({ isCreatingReport: false });
    const { container } = render(<ReportIssueForm />);
    expect(container.firstChild).toBeNull();
  });

  it('shows prompt to select location if reportCreationLocation is null', () => {
    useCommunityReportsStore.mockReturnValue({
      isCreatingReport: true,
      reportCreationLocation: null,
      setIsCreatingReport: mockSetIsCreatingReport
    });
    
    render(<ReportIssueForm />);
    expect(screen.getByText('Drag map & tap to set location')).toBeInTheDocument();
  });

  it('live checklist updates correctly as fields are filled', () => {
    render(<ReportIssueForm />);
    
    // Initial state (Description is empty, Photos are optional and start valid)
    expect(screen.getByTestId('check-location').textContent).toContain('✓');
    expect(screen.getByTestId('check-category').textContent).toContain('✓');
    expect(screen.getByTestId('check-severity').textContent).toContain('✓');
    expect(screen.getByTestId('check-description').textContent).toContain('✕');
    expect(screen.getByTestId('check-photos').textContent).toContain('✓');
    expect(screen.getByText('Submit Report')).toBeDisabled(); // Still disabled because description is empty

    // Fill description — should enable submit even without photos
    fireEvent.change(screen.getByPlaceholderText('Additional details...'), { target: { value: 'A bad pothole here' } });
    expect(screen.getByTestId('check-description').textContent).toContain('✓');
    expect(screen.getByText('Submit Report')).not.toBeDisabled();
    
    // Optionally add a photo — checklist should still be valid
    const fileInput = screen.getByLabelText(/Photo/i, { selector: 'input[type="file"]' });
    const file = new File(['hello'], 'hello.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    expect(screen.getByTestId('check-photos').textContent).toContain('✓');
    expect(screen.getByText('Submit Report')).not.toBeDisabled();
  });

  it('enforces max description length', () => {
    render(<ReportIssueForm />);
    const textarea = screen.getByPlaceholderText('Additional details...');
    expect(textarea.getAttribute('maxLength')).toBe(DEFAULT_CONFIG.communityReports.maxReportDescriptionLength.toString());
  });

  it('prevents submission of invalid file types', () => {
    render(<ReportIssueForm />);
    const fileInput = screen.getByLabelText(/Photo/i, { selector: 'input[type="file"]' });
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    expect(screen.getByRole('alert').textContent).toContain('Unsupported format');
  });

  it('handles successful submission and shows report ID', async () => {
    createReport.mockResolvedValue({ id: 'report_789', status: 'PENDING' });

    render(<ReportIssueForm />);
    
    // Fill out form
    fireEvent.change(screen.getByPlaceholderText('e.g. Large pothole in middle lane'), { target: { value: 'Test Title' } });
    fireEvent.change(screen.getByPlaceholderText('Additional details...'), { target: { value: 'Test description' } });
    
    const fileInput = screen.getByLabelText(/Photo/i, { selector: 'input[type="file"]' });
    const file = new File(['hello'], 'hello.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    const submitButton = screen.getByText('Submit Report');
    fireEvent.click(submitButton);
    
    expect(submitButton).toBeDisabled();
    
    await waitFor(() => {
      expect(createReport).toHaveBeenCalled();
      expect(mockRefreshReports).toHaveBeenCalled();
    });

    // Check success screen
    expect(screen.getByText('Report Submitted')).toBeInTheDocument();
    expect(screen.getByText('report_789')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  it('handles submission errors gracefully', async () => {
    createReport.mockRejectedValue(new Error('Network Error'));

    render(<ReportIssueForm />);
    
    fireEvent.change(screen.getByPlaceholderText('e.g. Large pothole in middle lane'), { target: { value: 'Test Title' } });
    fireEvent.change(screen.getByPlaceholderText('Additional details...'), { target: { value: 'Test description' } });
    const fileInput = screen.getByLabelText(/Photo/i, { selector: 'input[type="file"]' });
    const file = new File(['hello'], 'hello.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    fireEvent.click(screen.getByText('Submit Report'));
    
    await waitFor(() => {
      expect(createReport).toHaveBeenCalled();
      expect(screen.getByRole('alert').textContent).toContain('Network Error');
    });

    // Ensure form values are preserved
    expect(screen.getByPlaceholderText('Additional details...').value).toBe('Test description');
  });

});
