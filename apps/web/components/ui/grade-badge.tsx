"use client";

import { cn } from "@/lib/ui";

export interface GradeBadgeProps {
  score?: number;
  className?: string;
}

export const gradeLabelFromScore = (score?: number): string => {
  if (score === undefined) return "No grade";
  if (score >= 4.5) return "Excellent";
  if (score >= 3.5) return "Good";
  if (score >= 2.5) return "Neutral";
  return "Risk";
};

const gradeClassFromScore = (score?: number): string => {
  if (score === undefined) return "border-slate-300 bg-white text-slate-600";
  if (score >= 4.5) return "border-slate-900 bg-slate-900 text-slate-50";
  if (score >= 3.5) return "border-slate-700 bg-slate-100 text-slate-900";
  if (score >= 2.5) return "border-slate-400 bg-slate-50 text-slate-700";
  return "border-slate-800 bg-slate-200 text-slate-900";
};

export function GradeBadge({ score, className }: GradeBadgeProps) {
  const label = gradeLabelFromScore(score);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium",
        gradeClassFromScore(score),
        className
      )}
    >
      {score === undefined ? "No grade" : `${score.toFixed(1)} · ${label}`}
    </span>
  );
}

