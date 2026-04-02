"use client";

import { useState, ChangeEvent, InputHTMLAttributes } from "react";

interface PhoneInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  label?: string;
  /** Raw subscriber digits without country code, e.g. "7016258190" (max 10) */
  value: string;
  onChange: (subscriber: string) => void;
}

function formatPhone(subscriber: string): string {
  if (!subscriber) return "";
  let r = "+7 (" + subscriber.slice(0, 3);
  if (subscriber.length >= 3) r += ") ";
  if (subscriber.length > 3) r += subscriber.slice(3, 6);
  if (subscriber.length > 6) r += " " + subscriber.slice(6, 10);
  return r;
}

export function PhoneInput({ label = "Номер телефона", value, onChange, className, ...props }: PhoneInputProps) {
  const [focused, setFocused] = useState(false);
  const formatted = formatPhone(value);
  const floating = focused || value.length > 0;

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const all = e.target.value.replace(/\D/g, "");

    if (all.length === 0) {
      onChange("");
      return;
    }

    if (value.length > 0) {
      // Formatted "+7 (xxx...)" contributes a leading "7" to digits — strip it
      onChange(all.slice(1).slice(0, 10));
      return;
    }

    // Fresh input or paste into empty field
    if (all.length >= 11 && (all[0] === "7" || all[0] === "8")) {
      onChange(all.slice(1, 11));
    } else {
      onChange(all.slice(0, 10));
    }
  }

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
        type="tel"
        inputMode="numeric"
        value={formatted}
        onChange={handleChange}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        placeholder={focused ? "+7 (___) ___ ____" : ""}
        className={`
          w-full h-14 px-4 bg-bg-secondary rounded-lg border text-sm text-text-primary
          outline-none transition-colors duration-200 placeholder:text-text-muted
          ${focused ? "border-cyan shadow-[0_0_0_1px_rgba(0,229,255,0.3)]" : "border-surface-border"}
          ${className || ""}
        `}
      />
    </div>
  );
}
