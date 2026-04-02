import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({ variant = 'primary', loading, children, className = '', disabled, ...props }: ButtonProps) {
  const base = 'font-semibold py-3.5 px-6 rounded-xl w-full active:scale-[0.97] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base';

  const variants = {
    primary: 'bg-brand text-surface font-bold tracking-wide hover:bg-brand-light shadow-cyan',
    secondary: 'bg-surface-elevated text-white border border-white/10 hover:bg-surface-elevated/80',
    ghost: 'text-brand hover:bg-brand/10 border border-brand/30',
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={disabled || loading} {...props}>
      {loading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}
