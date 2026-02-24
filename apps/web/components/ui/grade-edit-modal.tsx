"use client";

import { useEffect, useState } from "react";
import { GradeEditForm, type GradeEditValues } from "@/components/ui/grade-edit-form";
import type { TenantGradeReason } from "@colonus/shared";

interface GradeEditModalProps {
  open: boolean;
  initialValue: GradeEditValues;
  title?: string;
  onClose: () => void;
  onSave: (value: GradeEditValues) => Promise<void> | void;
}

export function GradeEditModal({
  open,
  initialValue,
  title = "Edit Tenant Grade",
  onClose,
  onSave
}: GradeEditModalProps) {
  const [value, setValue] = useState<GradeEditValues>(initialValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setValue(initialValue);
    setError(undefined);
    setLoading(false);
  }, [open, initialValue]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-300 bg-white p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:border-slate-500"
            disabled={loading}
          >
            Close
          </button>
        </div>

        <GradeEditForm
          value={value}
          onChange={(next) =>
            setValue({
              score: next.score,
              reasons: [...new Set(next.reasons)] as TenantGradeReason[],
              note: next.note
            })
          }
          loading={loading}
          error={error}
          onCancel={onClose}
          onSubmit={async () => {
            const normalizedScore = Number.isFinite(value.score) ? value.score : 1;
            if (normalizedScore < 1 || normalizedScore > 5) {
              setError("Score must be between 1 and 5.");
              return;
            }
            setError(undefined);
            setLoading(true);
            try {
              await onSave({
                ...value,
                score: normalizedScore
              });
              onClose();
            } catch (saveError) {
              setError(saveError instanceof Error ? saveError.message : "Unable to save grade.");
            } finally {
              setLoading(false);
            }
          }}
        />
      </div>
    </div>
  );
}

