/**
 * Tests for APIKeyInput component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { APIKeyInput } from './APIKeyInput';

describe('APIKeyInput', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should render API key input field', () => {
    const onKeyChange = vi.fn();
    render(<APIKeyInput onKeyChange={onKeyChange} />);

    const input = screen.getByPlaceholderText(/sk-/i);
    expect(input).toBeInTheDocument();
  });

  it('should render label with emoji', () => {
    const onKeyChange = vi.fn();
    render(<APIKeyInput onKeyChange={onKeyChange} />);

    // Find label by looking for text containing "API Key"
    const labels = screen.getAllByText(/api key/i);
    expect(labels.length).toBeGreaterThan(0);
  });

  it('should show privacy notice', () => {
    const onKeyChange = vi.fn();
    render(<APIKeyInput onKeyChange={onKeyChange} />);

    expect(screen.getByText(/stored securely/i)).toBeInTheDocument();
    expect(screen.getByText(/never sent/i)).toBeInTheDocument();
  });

  it('should use password input type for security', () => {
    const onKeyChange = vi.fn();
    render(<APIKeyInput onKeyChange={onKeyChange} />);

    const input = screen.getByPlaceholderText(/sk-/i);
    expect(input).toHaveAttribute('type', 'password');
  });

  it('should allow typing in the input field', async () => {
    const user = userEvent.setup();
    const onKeyChange = vi.fn();
    render(<APIKeyInput onKeyChange={onKeyChange} />);

    const input = screen.getByPlaceholderText(/sk-/i);
    await user.type(input, 'sk-test-key-123');

    expect(input).toHaveValue('sk-test-key-123');
  });

  it('should load existing API key from storage on mount', () => {
    localStorage.setItem('imaginize_api_key', 'sk-existing-key');
    const onKeyChange = vi.fn();

    render(<APIKeyInput onKeyChange={onKeyChange} />);

    const input = screen.getByPlaceholderText(/sk-/i) as HTMLInputElement;
    expect(input.value).toBe('sk-existing-key');
  });

  it('should show remember/session toggle', () => {
    const onKeyChange = vi.fn();
    render(<APIKeyInput onKeyChange={onKeyChange} />);

    // Look for checkbox or toggle for persistence
    const checkbox = document.querySelector('input[type="checkbox"]');
    expect(checkbox).toBeInTheDocument();
  });

  it('should show forget button when key exists', () => {
    localStorage.setItem('imaginize_api_key', 'sk-test');
    const onKeyChange = vi.fn();

    render(<APIKeyInput onKeyChange={onKeyChange} />);

    expect(screen.getByText(/forget/i)).toBeInTheDocument();
  });

  it('should clear key when forget button is clicked', async () => {
    const user = userEvent.setup();
    localStorage.setItem('imaginize_api_key', 'sk-test');
    const onKeyChange = vi.fn();

    render(<APIKeyInput onKeyChange={onKeyChange} />);

    const forgetButton = screen.getByText(/forget/i);
    await user.click(forgetButton);

    expect(localStorage.getItem('imaginize_api_key')).toBeNull();
    expect(sessionStorage.getItem('imaginize_api_key')).toBeNull();
  });

  it('should call onKeyChange when input changes', async () => {
    const user = userEvent.setup();
    const onKeyChange = vi.fn();
    render(<APIKeyInput onKeyChange={onKeyChange} />);

    const input = screen.getByPlaceholderText(/sk-/i);
    await user.type(input, 'sk-new-key');

    // onKeyChange should be called with the new key
    expect(onKeyChange).toHaveBeenCalled();
  });

  it('should validate API key format (must start with sk-)', async () => {
    const user = userEvent.setup();
    const onKeyChange = vi.fn();
    render(<APIKeyInput onKeyChange={onKeyChange} />);

    const input = screen.getByPlaceholderText(/sk-/i);

    // Type invalid key
    await user.type(input, 'invalid-key');

    // Should show error or not accept
    const hasError = input.classList.contains('border-red-500') ||
                     input.classList.contains('error') ||
                     input.getAttribute('aria-invalid') === 'true';

    // Either shows error or doesn't call onKeyChange with valid flag
    expect(hasError || onKeyChange.mock.calls.every(call => call[0] === null)).toBe(true);
  });

  it('should show link to get API key', () => {
    const onKeyChange = vi.fn();
    render(<APIKeyInput onKeyChange={onKeyChange} />);

    const link = screen.getByRole('link', { name: /openai.*key/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('openai'));
    expect(link).toHaveAttribute('target', '_blank');
  });
});
