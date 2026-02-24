"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/ui";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "border border-slate-900 bg-slate-900 text-slate-50 hover:bg-slate-800 active:bg-slate-950",
  secondary:
    "border border-slate-300 bg-white text-slate-800 hover:border-slate-500 hover:bg-slate-50 active:bg-slate-100",
  ghost: "border border-transparent bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200",
  destructive:
    "border border-slate-900 bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300"
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-xs",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-5 text-sm"
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? "Loading..." : children}
    </button>
  );
}
