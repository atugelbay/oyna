import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Input({ label, error, icon, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-gray-400">{label}</label>}
      <div className="relative">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          className={`w-full bg-surface-input border ${
            error ? 'border-red-500/70' : 'border-white/10'
          } rounded-xl ${icon ? 'pl-11' : 'px-4'} pr-4 py-3.5 text-white placeholder-gray-500
          focus:outline-none focus:border-brand/50 transition-colors text-base ${className}`}
          {...props}
        />
      </div>
      {error && <span className="text-xs text-red-400 flex items-center gap-1">{error}</span>}
    </div>
  );
}
