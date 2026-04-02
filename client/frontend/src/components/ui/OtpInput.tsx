'use client';

import React, { useRef, useState, useEffect } from 'react';

interface OtpInputProps {
  length?: number;
  onComplete: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
}

export function OtpInput({ length = 4, onComplete, disabled, error }: OtpInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const char = val.slice(-1);
    const next = [...values];
    next[index] = char;
    setValues(next);
    if (char && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
    if (next.every((v) => v !== '')) {
      onComplete(next.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (values[index]) {
        const next = [...values];
        next[index] = '';
        setValues(next);
      } else if (index > 0) {
        inputs.current[index - 1]?.focus();
        const next = [...values];
        next[index - 1] = '';
        setValues(next);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (pasted) {
      const next = pasted.split('').concat(Array(length).fill('')).slice(0, length);
      setValues(next);
      const lastFilled = Math.min(pasted.length, length - 1);
      inputs.current[lastFilled]?.focus();
      if (pasted.length === length) onComplete(pasted);
    }
  };

  return (
    <div className="flex gap-3 justify-center">
      {values.map((val, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          type="tel"
          inputMode="numeric"
          maxLength={1}
          value={val}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className={`w-16 h-16 text-center text-2xl font-bold bg-surface-input rounded-xl text-white
            focus:outline-none transition-all
            ${error
              ? 'border-2 border-red-500/70'
              : val
              ? 'border-2 border-brand shadow-cyan-sm'
              : 'border border-white/10 focus:border-brand/50'
            }
            disabled:opacity-50`}
        />
      ))}
    </div>
  );
}
