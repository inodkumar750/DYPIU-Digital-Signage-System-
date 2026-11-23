import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'lg',
  children,
  footer,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeMap: Record<string, string> = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-5xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#290044]/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${sizeMap[size]} bg-white border border-[#E8E2EE] rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]`}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[#E8E2EE] bg-[#FAF8FC]">
          <div className="min-w-0">
            <h2
              id="modal-title"
              className="text-lg font-semibold text-[#290044] font-display truncate"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-[#645573] truncate">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-lg text-[#645573] hover:text-[#290044] hover:bg-[#EEE3B0]/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A2A78] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">{children}</div>

        {footer && (
          <div className="px-6 py-4 border-t border-[#E8E2EE] bg-[#FAF8FC] flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
