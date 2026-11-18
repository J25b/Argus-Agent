import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface ArgusLogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}

export const ArgusLogo: React.FC<ArgusLogoProps> = ({
  size = 28,
  showWordmark = true,
  className = '',
}) => {
  const reduced = useReducedMotion();

  return (
    <motion.span
      whileHover={reduced ? undefined : 'hovered'}
      className={`inline-flex items-center gap-2.5 select-none group ${className}`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        {/* Outer octagonal vigilance frame */}
        <path
          d="M18 3C10.8 3 4.8 8.2 2.4 18C4.8 27.8 10.8 33 18 33C25.2 33 31.2 27.8 33.6 18C31.2 8.2 25.2 3 18 3Z"
          stroke="#2388E8"
          strokeWidth="1.5"
        />
        {/* Inner almond aperture */}
        <path
          d="M6.5 18C9.8 12.2 13.7 9.5 18 9.5C22.3 9.5 26.2 12.2 29.5 18C26.2 23.8 22.3 26.5 18 26.5C13.7 26.5 9.8 23.8 6.5 18Z"
          stroke="#65B9FF"
          strokeWidth="1.35"
        />
        {/* Concentric iris ring with subtle hover scale */}
        <motion.circle
          cx="18"
          cy="18"
          r="5.25"
          stroke="#F4F7FC"
          strokeWidth="1.4"
          variants={{ hovered: { scale: 1.08 } }}
          transition={{ duration: 0.18 }}
          style={{ transformOrigin: '18px 18px' }}
        />
        {/* Central pupil */}
        <motion.circle
          cx="18"
          cy="18"
          r="2.1"
          fill="#2388E8"
          variants={{ hovered: { scale: 1.25 } }}
          transition={{ duration: 0.18 }}
          style={{ transformOrigin: '18px 18px' }}
        />
        {/* Symmetrical cardinal ticks */}
        <line x1="18" y1="5.2" x2="18" y2="7.5" stroke="#65B9FF" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="18" y1="28.5" x2="18" y2="30.8" stroke="#65B9FF" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      {showWordmark && (
        <span className="font-display text-base font-bold tracking-[0.14em] text-[#F4F7FC] whitespace-nowrap shrink-0">
          ARGUS
        </span>
      )}
    </motion.span>
  );
};
