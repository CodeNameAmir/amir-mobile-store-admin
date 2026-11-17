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
      className={`bg-white rounded-2xl border border-[#c3c6d7]/65 shadow-[0_1px_2px_rgba(11,28,48,0.04)] ${PADDING_MAP[padding]} ${className}`}
    >
      {children}
    </section>
  );
}
