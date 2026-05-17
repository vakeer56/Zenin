import React from 'react';

interface TimerRingProps {
  progress: number; // 0-1
  phase: 'work' | 'short_break' | 'long_break';
  size?: number;
  children?: React.ReactNode;
}

const phaseColors = {
  work: '#ffffff',
  short_break: '#a3e635',
  long_break: '#60a5fa',
};

export const TimerRing: React.FC<TimerRingProps> = ({
  progress,
  phase,
  size = 360,
  children,
}) => {
  const strokeWidth = 1.5; // Ultra-thin like Emphasis
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);
  const stroke = phaseColors[phase];

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        {/* Track (extremely subtle) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      {/* Inner content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
};
