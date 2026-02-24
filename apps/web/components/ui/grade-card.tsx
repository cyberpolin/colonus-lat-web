"use client";

import { GradeBadge, gradeLabelFromScore } from "@/components/ui/grade-badge";
import type { TenantGrade } from "@colonus/shared";

interface GradeCardProps {
  grade?: TenantGrade;
  emptyLabel?: string;
  footer?: React.ReactNode;
}

export function GradeCard({
  grade,
  emptyLabel = "No grade has been assigned for this property yet.",
  footer
}: GradeCardProps) {
  if (!grade) {
    return (
      <div className="rounded border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs uppercase tracking-wider text-slate-500">Tenant Grade</p>
        <p className="mt-2 text-sm text-slate-600">{emptyLabel}</p>
        {footer && <div className="mt-3">{footer}</div>}
      </div>
    );
  }

  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Tenant Grade</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{gradeLabelFromScore(grade.score)}</p>
        </div>
        <GradeBadge score={grade.score} />
      </div>
      {grade.reasons.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {grade.reasons.map((reason) => (
            <span
              key={reason}
              className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700"
            >
              {reason}
            </span>
          ))}
        </div>
      )}
      {grade.note && <p className="mt-2 text-xs text-slate-700">{grade.note}</p>}
      <p className="mt-2 text-[11px] text-slate-500">Last updated: {new Date(grade.updatedAt).toLocaleString()}</p>
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}

