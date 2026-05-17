import React from 'react';
import { cn } from '../../utils/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className, glow }) => (
  <div
    className={cn(
      'rounded-2xl glass p-6',
      glow && 'glow-primary',
      className
    )}
  >
    {children}
  </div>
);
