import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost";
}

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const base = "h-12 px-8 rounded-xl font-semibold text-sm transition-all duration-200 cursor-pointer";

  const variants = {
    primary:
      "bg-cyan text-bg-primary hover:brightness-110 active:scale-[0.98] shadow-[0_0_20px_rgba(0,229,255,0.3)]",
    ghost:
      "bg-transparent text-text-secondary hover:text-text-primary border border-surface-border",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
