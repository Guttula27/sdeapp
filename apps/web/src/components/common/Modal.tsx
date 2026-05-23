import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: React.ReactNode;
}

const SIZES = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-xl', xl: 'max-w-2xl' };

export default function Modal({ open, onClose, title, subtitle, children, size = 'md', footer }: Props) {
  const firstFocusable = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) firstFocusable.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className={clsx('relative w-full bg-white flex flex-col max-h-[90vh] animate-scale-in', SIZES[size])}
        style={{ borderRadius: '18px', boxShadow: '0 24px 64px -12px rgb(0 0 0 / .22), 0 0 0 1px rgb(0 0 0 / .05)' }}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button ref={firstFocusable} onClick={onClose}
            className="flex items-center justify-center w-7 h-7 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors ml-4 shrink-0">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0"
            style={{ background: '#fafafa', borderRadius: '0 0 18px 18px' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
