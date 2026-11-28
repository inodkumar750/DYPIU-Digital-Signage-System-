import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  text: string;
  tone?: 'info' | 'success' | 'error';
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4 sm:px-0"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start justify-between gap-3 px-4 py-3 rounded-xl text-white shadow-lg text-sm border ${
            toast.tone === 'error' ? 'bg-[#7f1d1d] border-red-400/60' : 'bg-[#290044] border-[#8A2A78]/50'
          }`}
        >
          <div className="flex items-start gap-2.5 min-w-0">
            {toast.tone === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#EEE3B0] shrink-0 mt-0.5" />
            ) : toast.tone === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-red-200 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 text-[#EEE3B0] shrink-0 mt-0.5" />
            )}
            <span className="leading-snug">{toast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
            className="text-white/70 hover:text-white p-0.5 rounded transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
