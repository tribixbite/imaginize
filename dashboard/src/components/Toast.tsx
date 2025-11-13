import { memo, useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  onClose: (id: string) => void;
}

// Helper function for toast styling
const getToastStyles = (type: ToastType): string => {
  switch (type) {
    case 'success':
      return 'bg-green-600 border-green-500';
    case 'error':
      return 'bg-red-600 border-red-500';
    case 'warning':
      return 'bg-yellow-600 border-yellow-500';
    case 'info':
      return 'bg-blue-600 border-blue-500';
  }
};

// Helper function for toast icons
const getToastIcon = (type: ToastType): string => {
  switch (type) {
    case 'success':
      return '✓';
    case 'error':
      return '✗';
    case 'warning':
      return '⚠';
    case 'info':
      return 'ℹ';
  }
};

// Helper function for ARIA role
const getToastRole = (type: ToastType): 'status' | 'alert' => {
  return type === 'error' || type === 'warning' ? 'alert' : 'status';
};

// Memoized toast component
export const Toast = memo(function Toast({ id, message, type, duration = 5000, onClose }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose(id);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-lg border-2 shadow-lg text-white animate-slide-in ${getToastStyles(
        type
      )}`}
      role={getToastRole(type)}
      aria-live={type === 'error' || type === 'warning' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <span className="text-xl flex-shrink-0" aria-hidden="true">
        {getToastIcon(type)}
      </span>
      <span className="flex-1 text-sm font-medium">{message}</span>
      <button
        onClick={() => onClose(id)}
        className="flex-shrink-0 text-white/80 hover:text-white transition-colors"
        aria-label="Close notification"
      >
        <span className="text-lg">×</span>
      </button>
    </div>
  );
});
