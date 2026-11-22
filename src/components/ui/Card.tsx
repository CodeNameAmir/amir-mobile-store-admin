import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PADDING_MAP: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  return (
    <section
      className={`bg-white rounded-xl border border-black/[0.08] shadow-[0_1px_2px_rgba(17,19,21,0.03)] ${PADDING_MAP[padding]} ${className}`}
    >
      {children}
    </section>
  );
}
