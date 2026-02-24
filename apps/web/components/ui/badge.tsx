import type { ReactNode } from "react";
import { cn } from "@/lib/ui";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "muted" | "strong";
}

const styles = {
  default: "border-slate-300 bg-slate-50 text-slate-700",
  muted: "border-slate-200 bg-white text-slate-500",
  strong: "border-slate-900 bg-slate-900 text-slate-50"
} as const;

export function Badge({ children, variant = "default" }: BadgeProps) {
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-medium", styles[variant])}>
      {children}
    </span>
  );
}
