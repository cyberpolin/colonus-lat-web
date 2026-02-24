import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/ui";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

export function Select({ hasError = false, className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-lg border bg-white px-3 text-sm text-slate-900",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
        hasError ? "border-slate-500" : "border-slate-300",
        "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
