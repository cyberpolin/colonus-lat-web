"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  STORAGE_KEYS,
  STORAGE_VERSION,
  TENANT_GRADE_REASONS,
  createId,
  nowIso,
  type TenantGrade,
  type TenantGradeReason
} from "@colonus/shared";

interface UpsertTenantGradeInput {
  propertyId: string;
  tenantId: string;
  score: number;
  reasons: TenantGradeReason[];
  note?: string;
  createdByUserId: string;
}

interface TenantGradesState {
  tenantGrades: TenantGrade[];
  getGrade: (propertyId: string, tenantId: string) => TenantGrade | undefined;
  listGradesForProperty: (propertyId: string) => TenantGrade[];
  upsertGrade: (input: UpsertTenantGradeInput) => TenantGrade;
  removeGrade: (propertyId: string, tenantId: string) => void;
}

const clampScore = (value: number): number => {
  if (!Number.isFinite(value)) return 1;
  if (value < 1) return 1;
  if (value > 5) return 5;
  return Math.round(value * 10) / 10;
};

const normalizeReasons = (reasons: TenantGradeReason[]): TenantGradeReason[] => {
  const valid = reasons.filter((reason): reason is TenantGradeReason =>
    TENANT_GRADE_REASONS.includes(reason)
  );
  return [...new Set(valid)];
};

// Local-first grade state. Future sync can enqueue "tenant_grade" upserts by version.
export const useTenantGradesStore = create<TenantGradesState>()(
  persist(
    (set, get) => ({
      tenantGrades: [],
      getGrade: (propertyId, tenantId) =>
        get().tenantGrades.find(
          (grade) => grade.propertyId === propertyId && grade.tenantId === tenantId
        ),
      listGradesForProperty: (propertyId) =>
        get().tenantGrades.filter((grade) => grade.propertyId === propertyId),
      upsertGrade: (input) => {
        const now = nowIso();
        const nextScore = clampScore(input.score);
        const nextReasons = normalizeReasons(input.reasons);
        const nextNote = input.note?.trim() ? input.note.trim() : undefined;
        const existing = get().getGrade(input.propertyId, input.tenantId);
        const record: TenantGrade = existing
          ? {
              ...existing,
              score: nextScore,
              reasons: nextReasons,
              note: nextNote,
              createdByUserId: input.createdByUserId,
              updatedAt: now,
              version: existing.version + 1
            }
          : {
              id: createId("tenant_grade"),
              propertyId: input.propertyId,
              tenantId: input.tenantId,
              score: nextScore,
              reasons: nextReasons,
              note: nextNote,
              createdByUserId: input.createdByUserId,
              createdAt: now,
              updatedAt: now,
              version: 1
            };

        set((state) => ({
          tenantGrades: existing
            ? state.tenantGrades.map((grade) =>
                grade.propertyId === input.propertyId && grade.tenantId === input.tenantId
                  ? record
                  : grade
              )
            : [...state.tenantGrades, record]
        }));

        return record;
      },
      removeGrade: (propertyId, tenantId) =>
        set((state) => ({
          tenantGrades: state.tenantGrades.filter(
            (grade) => !(grade.propertyId === propertyId && grade.tenantId === tenantId)
          )
        }))
    }),
    {
      name: STORAGE_KEYS.tenantGrades,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ tenantGrades: state.tenantGrades }),
      migrate: (persistedState) => {
        const raw = persistedState as Partial<TenantGradesState>;
        return {
          tenantGrades: (raw.tenantGrades ?? []).map((grade) => ({
            ...grade,
            score: clampScore(Number(grade.score)),
            reasons: normalizeReasons((grade.reasons ?? []) as TenantGradeReason[]),
            version: Number.isFinite(grade.version) ? Math.max(1, Math.trunc(grade.version)) : 1
          }))
        };
      }
    }
  )
);

export const setTenantGrades = (tenantGrades: TenantGrade[]): void => {
  useTenantGradesStore.setState({ tenantGrades });
};

export const clearTenantGrades = (): void => {
  useTenantGradesStore.setState({ tenantGrades: [] });
};
