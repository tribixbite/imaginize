/**
 * Tests for ProcessingProgress component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProcessingProgress } from './ProcessingProgress';
import type { ProcessingState, ActivityLog } from '../types';

describe('ProcessingProgress', () => {
  const createState = (overrides: Partial<ProcessingState> = {}): ProcessingState => ({
    phase: 'idle',
    progress: 0,
    currentStep: 'Waiting to start',
    estimatedTimeRemaining: undefined,
    ...overrides,
  });

  const createActivityLog = (overrides: Partial<ActivityLog> = {}): ActivityLog => ({
    type: 'info',
    message: 'Test message',
    timestamp: new Date(),
    ...overrides,
  });

  it('should render phase icon and label', () => {
    const state = createState({ phase: 'parsing' });
    const { container } = render(<ProcessingProgress state={state} activityLogs={[]} />);

    // Icon appears in header (large) and phase steps (small)
    const icons = screen.getAllByText('📖');
    expect(icons.length).toBeGreaterThan(0);

    // Check header specifically
    const header = container.querySelector('.text-5xl');
    expect(header).toHaveTextContent('📖');

    const heading = container.querySelector('h2');
    expect(heading).toHaveTextContent('Parsing');
  });

  it('should display current step message', () => {
    const state = createState({ currentStep: 'Extracting chapters...' });
    render(<ProcessingProgress state={state} activityLogs={[]} />);

    expect(screen.getByText('Extracting chapters...')).toBeInTheDocument();
  });

  it('should show progress percentage', () => {
    const state = createState({ progress: 42 });
    render(<ProcessingProgress state={state} activityLogs={[]} />);

    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('should display progress bar with correct width', () => {
    const state = createState({ progress: 65 });
    const { container } = render(<ProcessingProgress state={state} activityLogs={[]} />);

    const progressBar = container.querySelector('.bg-blue-600');
    expect(progressBar).toHaveStyle({ width: '65%' });
  });

  it('should show estimated time remaining when provided', () => {
    const state = createState({ estimatedTimeRemaining: 90 });
    render(<ProcessingProgress state={state} activityLogs={[]} />);

    expect(screen.getByText(/1m 30s remaining/i)).toBeInTheDocument();
  });

  it('should format time under 60 seconds correctly', () => {
    const state = createState({ estimatedTimeRemaining: 45 });
    render(<ProcessingProgress state={state} activityLogs={[]} />);

    expect(screen.getByText(/45s remaining/i)).toBeInTheDocument();
  });

  it('should not show time remaining when undefined', () => {
    const state = createState({ estimatedTimeRemaining: undefined });
    render(<ProcessingProgress state={state} activityLogs={[]} />);

    expect(screen.queryByText(/remaining/i)).not.toBeInTheDocument();
  });

  it('should not show time remaining when zero', () => {
    const state = createState({ estimatedTimeRemaining: 0 });
    render(<ProcessingProgress state={state} activityLogs={[]} />);

    expect(screen.queryByText(/remaining/i)).not.toBeInTheDocument();
  });

  it('should display all phase steps', () => {
    const state = createState({ phase: 'idle' });
    render(<ProcessingProgress state={state} activityLogs={[]} />);

    // Should show all 4 phase steps
    expect(screen.getByText('Parsing')).toBeInTheDocument();
    expect(screen.getByText('Analyzing')).toBeInTheDocument();
    expect(screen.getByText('Illustrating')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('should highlight active phase with animate-pulse', () => {
    const state = createState({ phase: 'analyzing' });
    const { container } = render(<ProcessingProgress state={state} activityLogs={[]} />);

    const activePhase = container.querySelector('.animate-pulse');
    expect(activePhase).toBeInTheDocument();
  });

  it('should mark completed phases with checkmark', () => {
    const state = createState({ phase: 'illustrating' });
    const { container } = render(<ProcessingProgress state={state} activityLogs={[]} />);

    // Parsing and analyzing should be complete (show checkmark)
    const completedPhases = container.querySelectorAll('.bg-green-500');
    expect(completedPhases.length).toBeGreaterThan(0);
  });

  it('should display activity logs in reverse order', () => {
    const logs: ActivityLog[] = [
      createActivityLog({ message: 'First log', timestamp: new Date('2025-01-01T10:00:00') }),
      createActivityLog({ message: 'Second log', timestamp: new Date('2025-01-01T10:01:00') }),
      createActivityLog({ message: 'Third log', timestamp: new Date('2025-01-01T10:02:00') }),
    ];
    const state = createState();
    render(<ProcessingProgress state={state} activityLogs={logs} />);

    const logElements = screen.getAllByText(/log/i);
    expect(logElements[0]).toHaveTextContent('Third log');
    expect(logElements[1]).toHaveTextContent('Second log');
    expect(logElements[2]).toHaveTextContent('First log');
  });

  it('should show only last 10 activity logs', () => {
    const logs: ActivityLog[] = Array.from({ length: 15 }, (_, i) =>
      createActivityLog({ message: `Log ${i + 1}` })
    );
    const state = createState();
    render(<ProcessingProgress state={state} activityLogs={logs} />);

    // Should only show logs 6-15 (last 10)
    expect(screen.queryByText('Log 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Log 5')).not.toBeInTheDocument();
    expect(screen.getByText('Log 6')).toBeInTheDocument();
    expect(screen.getByText('Log 15')).toBeInTheDocument();
  });

  it('should display success log with green checkmark', () => {
    const logs: ActivityLog[] = [
      createActivityLog({ type: 'success', message: 'Operation succeeded' }),
    ];
    const state = createState();
    const { container } = render(<ProcessingProgress state={state} activityLogs={logs} />);

    expect(screen.getByText('Operation succeeded')).toBeInTheDocument();
    expect(container.querySelector('.text-green-600')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('should display error log with red X', () => {
    const logs: ActivityLog[] = [
      createActivityLog({ type: 'error', message: 'Operation failed' }),
    ];
    const state = createState();
    const { container } = render(<ProcessingProgress state={state} activityLogs={logs} />);

    expect(screen.getByText('Operation failed')).toBeInTheDocument();
    expect(container.querySelector('.text-red-600')).toBeInTheDocument();
    expect(screen.getByText('✗')).toBeInTheDocument();
  });

  it('should display warning log with yellow warning icon', () => {
    const logs: ActivityLog[] = [
      createActivityLog({ type: 'warning', message: 'Warning message' }),
    ];
    const state = createState();
    const { container } = render(<ProcessingProgress state={state} activityLogs={logs} />);

    expect(screen.getByText('Warning message')).toBeInTheDocument();
    expect(container.querySelector('.text-yellow-600')).toBeInTheDocument();
    expect(screen.getByText('⚠')).toBeInTheDocument();
  });

  it('should display info log with bullet point', () => {
    const logs: ActivityLog[] = [
      createActivityLog({ type: 'info', message: 'Info message' }),
    ];
    const state = createState();
    const { container } = render(<ProcessingProgress state={state} activityLogs={logs} />);

    expect(screen.getByText('Info message')).toBeInTheDocument();
    expect(container.querySelector('.text-gray-600')).toBeInTheDocument();
    expect(screen.getByText('•')).toBeInTheDocument();
  });

  it('should display log timestamps', () => {
    const timestamp = new Date('2025-01-01T14:30:00');
    const logs: ActivityLog[] = [
      createActivityLog({ message: 'Timestamped log', timestamp }),
    ];
    const state = createState();
    render(<ProcessingProgress state={state} activityLogs={logs} />);

    expect(screen.getByText('Timestamped log')).toBeInTheDocument();
    // Timestamp should be displayed in locale time format
    const timeString = timestamp.toLocaleTimeString();
    expect(screen.getByText(timeString)).toBeInTheDocument();
  });

  it('should show cancel button during active processing', () => {
    const state = createState({ phase: 'parsing' });
    const onCancel = vi.fn();
    render(<ProcessingProgress state={state} activityLogs={[]} onCancel={onCancel} />);

    expect(screen.getByText('Cancel Processing')).toBeInTheDocument();
  });

  it('should call onCancel when cancel button clicked', async () => {
    const user = userEvent.setup();
    const state = createState({ phase: 'analyzing' });
    const onCancel = vi.fn();
    render(<ProcessingProgress state={state} activityLogs={[]} onCancel={onCancel} />);

    const cancelButton = screen.getByText('Cancel Processing');
    await user.click(cancelButton);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should not show cancel button when phase is idle', () => {
    const state = createState({ phase: 'idle' });
    const onCancel = vi.fn();
    render(<ProcessingProgress state={state} activityLogs={[]} onCancel={onCancel} />);

    expect(screen.queryByText('Cancel Processing')).not.toBeInTheDocument();
  });

  it('should not show cancel button when phase is complete', () => {
    const state = createState({ phase: 'complete' });
    const onCancel = vi.fn();
    render(<ProcessingProgress state={state} activityLogs={[]} onCancel={onCancel} />);

    expect(screen.queryByText('Cancel Processing')).not.toBeInTheDocument();
  });

  it('should not show cancel button when phase is error', () => {
    const state = createState({ phase: 'error' });
    const onCancel = vi.fn();
    render(<ProcessingProgress state={state} activityLogs={[]} onCancel={onCancel} />);

    expect(screen.queryByText('Cancel Processing')).not.toBeInTheDocument();
  });

  it('should not show cancel button when onCancel is not provided', () => {
    const state = createState({ phase: 'parsing' });
    render(<ProcessingProgress state={state} activityLogs={[]} />);

    expect(screen.queryByText('Cancel Processing')).not.toBeInTheDocument();
  });

  it('should show correct icons for all phases', () => {
    const phases = [
      { phase: 'idle' as const, icon: '⏳', label: 'Ready' },
      { phase: 'parsing' as const, icon: '📖', label: 'Parsing' },
      { phase: 'analyzing' as const, icon: '🔍', label: 'Analyzing' },
      { phase: 'extracting' as const, icon: '📝', label: 'Extracting' },
      { phase: 'illustrating' as const, icon: '🎨', label: 'Illustrating' },
      { phase: 'complete' as const, icon: '✅', label: 'Complete' },
      { phase: 'error' as const, icon: '❌', label: 'Error' },
    ];

    phases.forEach(({ phase, icon, label }) => {
      const state = createState({ phase });
      const { container, unmount } = render(<ProcessingProgress state={state} activityLogs={[]} />);

      // Icon appears in header (large) - check the header specifically
      const header = container.querySelector('.text-5xl');
      expect(header).toHaveTextContent(icon);

      // Label appears in H2 header and phase steps - check H2 specifically
      const heading = container.querySelector('h2');
      expect(heading).toHaveTextContent(label);

      unmount();
    });
  });
});
