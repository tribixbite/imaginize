/**
 * localStorage management for API keys and user preferences
 */

import type { APIKeyConfig } from '../types';

const STORAGE_KEYS = {
  API_KEY: 'imaginize_api_key',
  SESSION_ONLY: 'imaginize_session_only',
  LAST_USED: 'imaginize_last_used',
} as const;

/**
 * Save API key to localStorage or sessionStorage
 */
export function saveAPIKey(key: string, sessionOnly: boolean): void {
  const storage = sessionOnly ? sessionStorage : localStorage;

  storage.setItem(STORAGE_KEYS.API_KEY, key);
  storage.setItem(STORAGE_KEYS.SESSION_ONLY, String(sessionOnly));
  storage.setItem(STORAGE_KEYS.LAST_USED, new Date().toISOString());
}

/**
 * Load API key from storage
 */
export function loadAPIKey(): APIKeyConfig | null {
  // Try sessionStorage first
  let key = sessionStorage.getItem(STORAGE_KEYS.API_KEY);
  let sessionOnly = true;

  // Fall back to localStorage
  if (!key) {
    key = localStorage.getItem(STORAGE_KEYS.API_KEY);
    sessionOnly = false;
  }

  if (!key) {
    return null;
  }

  const lastUsedStr = (sessionOnly ? sessionStorage : localStorage).getItem(STORAGE_KEYS.LAST_USED);
  const lastUsed = lastUsedStr ? new Date(lastUsedStr) : undefined;

  return {
    key,
    sessionOnly,
    lastUsed,
  };
}

/**
 * Clear API key from all storage
 */
export function clearAPIKey(): void {
  localStorage.removeItem(STORAGE_KEYS.API_KEY);
  localStorage.removeItem(STORAGE_KEYS.SESSION_ONLY);
  localStorage.removeItem(STORAGE_KEYS.LAST_USED);

  sessionStorage.removeItem(STORAGE_KEYS.API_KEY);
  sessionStorage.removeItem(STORAGE_KEYS.SESSION_ONLY);
  sessionStorage.removeItem(STORAGE_KEYS.LAST_USED);
}

/**
 * Check if API key exists in storage
 */
export function hasAPIKey(): boolean {
  return !!sessionStorage.getItem(STORAGE_KEYS.API_KEY) || !!localStorage.getItem(STORAGE_KEYS.API_KEY);
}
