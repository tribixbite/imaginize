/**
 * Tests for storage utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { saveAPIKey, loadAPIKey, clearAPIKey, hasAPIKey } from './storage';

const STORAGE_KEYS = {
  API_KEY: 'imaginize_api_key',
  SESSION_ONLY: 'imaginize_session_only',
  LAST_USED: 'imaginize_last_used',
};

describe('storage utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('saveAPIKey', () => {
    it('should save API key to localStorage when sessionOnly is false', () => {
      const apiKey = 'sk-test-key-123';
      saveAPIKey(apiKey, false);

      expect(localStorage.getItem(STORAGE_KEYS.API_KEY)).toBe(apiKey);
      expect(localStorage.getItem(STORAGE_KEYS.SESSION_ONLY)).toBe('false');
      expect(localStorage.getItem(STORAGE_KEYS.LAST_USED)).toBeTruthy();
    });

    it('should save API key to sessionStorage when sessionOnly is true', () => {
      const apiKey = 'sk-test-key-456';
      saveAPIKey(apiKey, true);

      expect(sessionStorage.getItem(STORAGE_KEYS.API_KEY)).toBe(apiKey);
      expect(sessionStorage.getItem(STORAGE_KEYS.SESSION_ONLY)).toBe('true');
      expect(sessionStorage.getItem(STORAGE_KEYS.LAST_USED)).toBeTruthy();
    });

    it('should save last used timestamp', () => {
      const before = new Date();
      saveAPIKey('sk-test', false);
      const after = new Date();

      const lastUsedStr = localStorage.getItem(STORAGE_KEYS.LAST_USED);
      expect(lastUsedStr).toBeTruthy();

      const lastUsed = new Date(lastUsedStr!);
      expect(lastUsed.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(lastUsed.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('loadAPIKey', () => {
    it('should load API key from localStorage', () => {
      saveAPIKey('sk-local-key', false);

      const config = loadAPIKey();

      expect(config).toBeTruthy();
      expect(config?.key).toBe('sk-local-key');
      expect(config?.sessionOnly).toBe(false);
      expect(config?.lastUsed).toBeInstanceOf(Date);
    });

    it('should load API key from sessionStorage', () => {
      saveAPIKey('sk-session-key', true);

      const config = loadAPIKey();

      expect(config).toBeTruthy();
      expect(config?.key).toBe('sk-session-key');
      expect(config?.sessionOnly).toBe(true);
      expect(config?.lastUsed).toBeInstanceOf(Date);
    });

    it('should prioritize sessionStorage over localStorage', () => {
      saveAPIKey('sk-local', false);
      saveAPIKey('sk-session', true);

      const config = loadAPIKey();

      expect(config?.key).toBe('sk-session');
      expect(config?.sessionOnly).toBe(true);
    });

    it('should return null when no key is stored', () => {
      expect(loadAPIKey()).toBeNull();
    });
  });

  describe('clearAPIKey', () => {
    it('should remove API key from both localStorage and sessionStorage', () => {
      saveAPIKey('sk-local', false);
      saveAPIKey('sk-session', true);

      clearAPIKey();

      expect(localStorage.getItem(STORAGE_KEYS.API_KEY)).toBeNull();
      expect(sessionStorage.getItem(STORAGE_KEYS.API_KEY)).toBeNull();
      expect(loadAPIKey()).toBeNull();
    });

    it('should work when no key is stored', () => {
      expect(() => clearAPIKey()).not.toThrow();
    });
  });

  describe('hasAPIKey', () => {
    it('should return true when key exists in localStorage', () => {
      saveAPIKey('sk-test', false);
      expect(hasAPIKey()).toBe(true);
    });

    it('should return true when key exists in sessionStorage', () => {
      saveAPIKey('sk-test', true);
      expect(hasAPIKey()).toBe(true);
    });

    it('should return false when no key is stored', () => {
      expect(hasAPIKey()).toBe(false);
    });
  });
});
