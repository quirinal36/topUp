import { ReactNode } from 'react';
import { clsx } from 'clsx';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  'data-testid'?: string;
}

export default function Card({ children, className, onClick, hoverable = false, 'data-testid': testId }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-white rounded-card shadow-card p-4',
        'dark:bg-[#2d2420] dark:shadow-none dark:border dark:border-primary-800/30',
        hoverable && 'hover:shadow-card-hover transition-shadow duration-200 cursor-pointer',
        className
      )}
      onClick={onClick}
      data-testid={testId}
    >
      {children}
    </div>
  );
}
