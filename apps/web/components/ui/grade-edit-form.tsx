"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TENANT_GRADE_REASONS, type TenantGradeReason } from "@colonus/shared";

export interface GradeEditValues {
  score: number;
  reasons: TenantGradeReason[];
  note: string;
}

interface GradeEditFormProps {
  value: GradeEditValues;
  onChange: (next: GradeEditValues) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
}

export function GradeEditForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  disabled = false,
  loading = false,
  error
}: GradeEditFormProps) {
  const formDisabled = disabled || loading;
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!formDisabled) onSubmit();
      }}
    >
      <label className="block text-xs text-slate-600">
        Score (1.0 - 5.0)
        <Input
          type="number"
          min="1"
          max="5"
          step="0.1"
          disabled={formDisabled}
          value={value.score}
          onChange={(event) =>
            onChange({
              ...value,
              score: Number(event.target.value)
            })
          }
          className="mt-1"
        />
      </label>

      <fieldset className="space-y-2" disabled={formDisabled}>
        <legend className="text-xs text-slate-600">Reasons</legend>
        <div className="grid gap-2 md:grid-cols-2">
          {TENANT_GRADE_REASONS.map((reason) => {
            const checked = value.reasons.includes(reason);
            return (
              <label key={reason} className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    onChange({
                      ...value,
                      reasons: event.target.checked
                        ? [...value.reasons, reason]
                        : value.reasons.filter((item) => item !== reason)
                    });
                  }}
                />
                {reason}
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="block text-xs text-slate-600">
        Note (optional)
        <Textarea
          rows={3}
          disabled={formDisabled}
          value={value.note}
          onChange={(event) =>
            onChange({
              ...value,
              note: event.target.value
            })
          }
          className="mt-1"
          placeholder="Context for this grade"
        />
      </label>

      {error && <p className="text-xs text-slate-700">{error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" loading={loading} disabled={disabled}>
          Save Grade
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={formDisabled}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

