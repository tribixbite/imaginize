/**
 * Tests for useLocalStorage hook
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from './useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return initial value when no stored value exists', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    expect(result.current[0]).toBe('initial');
  });

  it('should return stored value if it exists', () => {
    localStorage.setItem('test-key', JSON.stringify('stored-value'));

    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    expect(result.current[0]).toBe('stored-value');
  });

  it('should update localStorage when value changes', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    act(() => {
      result.current[1]('new-value');
    });

    expect(localStorage.getItem('test-key')).toBe(JSON.stringify('new-value'));
    expect(result.current[0]).toBe('new-value');
  });

  it('should handle complex objects', () => {
    const initialValue = { name: 'Test', count: 0 };
    const { result } = renderHook(() => useLocalStorage('object-key', initialValue));

    expect(result.current[0]).toEqual(initialValue);

    const newValue = { name: 'Updated', count: 5 };
    act(() => {
      result.current[1](newValue);
    });

    expect(result.current[0]).toEqual(newValue);
    expect(JSON.parse(localStorage.getItem('object-key') || '')).toEqual(newValue);
  });

  it('should handle null values', () => {
    const { result } = renderHook(() => useLocalStorage<string | null>('nullable', null));

    expect(result.current[0]).toBeNull();

    act(() => {
      result.current[1]('value');
    });

    expect(result.current[0]).toBe('value');

    act(() => {
      result.current[1](null);
    });

    expect(result.current[0]).toBeNull();
  });

  it('should use initial value if stored value is invalid JSON', () => {
    localStorage.setItem('broken-key', 'invalid-json{');

    const { result } = renderHook(() => useLocalStorage('broken-key', 'fallback'));

    expect(result.current[0]).toBe('fallback');
  });
});
