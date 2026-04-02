"use client";

import { useState, InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  isPassword?: boolean;
}

export function Input({ label, isPassword, type, className, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const hasValue = props.value !== undefined && props.value !== "";
  const floating = focused || hasValue;

  const inputType = isPassword ? (showPassword ? "text" : "password") : type;
  const isDate = type === "date";

  return (
    <div className="relative w-full group">
      <label
        className={`
          absolute left-4 z-10 transition-all duration-200 pointer-events-none
          ${floating
            ? "-top-2.5 text-xs text-cyan bg-bg-secondary px-1"
            : "top-1/2 -translate-y-1/2 text-text-secondary text-sm"
          }
        `}
      >
        {label}
      </label>
      <input
        {...props}
        type={inputType}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        className={`
          w-full h-14 px-4 bg-bg-secondary rounded-lg border text-sm text-text-primary
          outline-none transition-colors duration-200
          ${focused ? "border-cyan shadow-[0_0_0_1px_rgba(0,229,255,0.3)]" : "border-surface-border"}
          ${isPassword || isDate ? "pr-12" : ""}
          ${isDate && !hasValue ? "text-transparent" : ""}
          [color-scheme:dark]
          ${className || ""}
        `}
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
        >
          {showPassword ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      )}
      {isDate && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none">
          <CalendarIcon />
        </div>
      )}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
