import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/ui";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export function Input({ hasError = false, className, ...props }: InputProps) {
  const isChoiceControl = props.type === "checkbox" || props.type === "radio";

  return (
    <input
      className={cn(
        isChoiceControl
          ? "h-4 w-4 rounded border bg-white text-slate-900"
          : "h-11 w-full rounded-lg border bg-white px-3 text-sm text-slate-900",
        !isChoiceControl && "placeholder:text-slate-400",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
        hasError ? "border-slate-500" : "border-slate-300",
        isChoiceControl
          ? "disabled:cursor-not-allowed"
          : "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500",
        className
      )}
      {...props}
    />
  );
}
