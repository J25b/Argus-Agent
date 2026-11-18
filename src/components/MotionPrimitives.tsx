import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';

export const FAST_EASE = [0.16, 1, 0.3, 1] as const;

export const PageTransition: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: FAST_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export const AnimatedNumber: React.FC<{ value: number; className?: string }> = ({
  value,
  className = '',
}) => {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    let frame = 0;
    const duration = 420;
    const startVal = display;
    const diff = value - startVal;
    if (diff === 0) return;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(startVal + diff * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);

  return <span className={`tabular-nums ${className}`}>{display.toLocaleString()}</span>;
};

interface SlideDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export const SlideDrawer: React.FC<SlideDrawerProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
}) => {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/65 backdrop-blur-[2px]"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={reduced ? { opacity: 0 } : { x: '100%' }}
            animate={reduced ? { opacity: 1 } : { x: 0 }}
            exit={reduced ? { opacity: 0 } : { x: '100%' }}
            transition={{ duration: 0.2, ease: FAST_EASE }}
            className="relative z-10 w-full max-w-xl bg-[#0B1325] border-l border-[#1E3354] flex flex-col h-full shadow-2xl"
          >
            <div className="px-6 py-4 border-b border-[#1E3354] flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-0.5">
                <h2 className="font-display text-base font-semibold text-[#F4F7FC] truncate">{title}</h2>
                {subtitle && <p className="font-mono text-xs text-[#65B9FF] truncate">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close panel"
                className="p-1.5 text-[#8796AB] hover:text-[#F4F7FC] rounded border border-[#1E3354] hover:border-[#65B9FF]/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};
