"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  PROOF_IMAGE_PLACEHOLDER_URL,
  STORAGE_VERSION,
  getStorageKeys,
  createId,
  nowIso,
  type CareProofSubmission,
  type ColonusState,
  type FixRequest,
  type Landlord,
  type MediaUploadStub,
  type PaymentSubmission,
  type PaymentPeriod,
  type PermissionRequest,
  type RefundRequest,
  type Ticket,
  type PlanTier,
  type RentCycleMonths,
  type ProofRequirement,
  type Property,
  type PropertyProofSettings,
  type PropertySubscription,
  type PropertyExpense,
  type SubscriptionStatus,
  type SuperAdminProfile,
  type SyncMutation,
  type Tenant,
  type TenantGrade,
  type UserRole
} from "@colonus/shared";
import { clearChangeLog, clearOutbox, enqueueMutation, getOutboxQueue } from "@colonus/sync";
import {
  loginWithKeystone,
  provisionKeystoneUser,
  provisionKeystoneUsers,
  type KeystoneUserRecord
} from "@/lib/auth-api";
import { defaultThemeColorSelection, legacyThemeSelection } from "@/lib/color-themes";
import { clearTenantGrades, setTenantGrades } from "@/lib/tenant-grades-store";

interface ColonusUiState extends ColonusState {
  authSession?: {
    role: UserRole;
    userId: string;
    keystoneUserId?: string;
    email: string;
    fullName: string;
    loggedInAt: string;
  };
  activeRole: UserRole;
  impersonationRole?: UserRole;
  activeSuperAdminId?: string;
  activeLandlordId?: string;
  activeTenantId?: string;
  themeColorHex: string;
  themeHueRotate: number;
  devBannerCollapsed: boolean;
  syncUsageByProperty: Record<string, { date: string; count: number }>;
  lastSyncNotice?: string;
  setActiveRole: (role: UserRole) => void;
  selectImpersonationRole: (role: UserRole) => void;
  setActiveSuperAdminId: (superAdminId: string) => void;
  setActiveLandlordId: (landlordId: string) => void;
  setActiveTenantId: (tenantId: string) => void;
  setThemeColor: (input: { hex: string; hueRotate: number }) => void;
  setDevBannerCollapsed: (collapsed: boolean) => void;
  loginWithPassword: (
    input: { email: string; password: string }
  ) => Promise<
    | { ok: true; role: UserRole; requiresPasswordChange?: boolean; firstTimePasswordToken?: string }
    | { ok: false; error: string }
  >;
  logout: () => void;
  addTenant: (input: Omit<Tenant, "id" | "createdAt" | "updatedAt">) => Promise<Tenant>;
  addLandlord: (
    input: Omit<Landlord, "id" | "createdAt" | "updatedAt" | "status" | "credentialsSentAt">
  ) => Promise<Landlord>;
  addProperty: (input: Omit<Property, "id" | "createdAt" | "updatedAt">) => Property;
  updateLandlord: (input: {
    landlordId: string;
    fullName: string;
    email: string;
    phone?: string;
    paymentSubmissionFrequency: Landlord["paymentSubmissionFrequency"];
    proofSubmissionFrequency: Landlord["proofSubmissionFrequency"];
  }) => void;
  setLandlordStatus: (input: { landlordId: string; status: Landlord["status"] }) => void;
  setLandlordTier: (input: {
    landlordId: string;
    tier: PlanTier;
    subscriptionStatus: SubscriptionStatus;
  }) => void;
  markLandlordCredentialsSent: (landlordId: string) => void;
  setPropertySubscriptionTier: (input: {
    propertyId: string;
    tier: PlanTier;
    subscriptionStatus: SubscriptionStatus;
    billingProviderId?: string;
    trialEndsAt?: string;
  }) => void;
  updateTenantSettings: (input: {
    tenantId: string;
    rentCycleMonths: Tenant["rentCycleMonths"];
    rentAmountCents: number;
    propertyId: string;
  }) => void;
  updatePropertySettings: (input: {
    propertyId: string;
    name: string;
    address: string;
    unitCode?: string;
    monthlyRentCents: number;
  }) => void;
  setPropertyProofRequirement: (input: {
    propertyId: string;
    field: "rentPaymentProof" | "servicePaymentProof" | "careProof";
    requirement: ProofRequirement;
  }) => void;
  submitPayment: (
    input: Omit<PaymentSubmission, "id" | "createdAt" | "updatedAt" | "submittedAt" | "status">
  ) => void;
  submitCareProof: (
    input: Omit<CareProofSubmission, "id" | "createdAt" | "updatedAt" | "submittedAt" | "status">
  ) => void;
  approvePayment: (paymentId: string) => void;
  rejectPayment: (input: { paymentId: string; reason: string }) => void;
  approveConditionProof: (careProofId: string) => void;
  rejectConditionProof: (input: { careProofId: string; reason: string }) => void;
  addPropertyExpense: (input: Omit<PropertyExpense, "id" | "createdAt" | "updatedAt">) => void;
  createPaymentPeriod: (input: {
    landlordId: string;
    propertyId?: string;
    label: string;
    durationMonths: number;
    startDate: string;
    endDate: string;
    dueDay?: number;
  }) => PaymentPeriod;
  submitRefundRequest: (
    input: Omit<RefundRequest, "id" | "createdAt" | "updatedAt" | "status" | "syncStatus">
  ) => void;
  reviewRefundRequest: (input: {
    refundRequestId: string;
    status: RefundRequest["status"];
    decisionNote: string;
  }) => void;
  createTicket: (
    input: Omit<Ticket, "id" | "createdAt" | "updatedAt" | "status" | "syncStatus">
  ) => void;
  updateTicketStatus: (input: { ticketId: string; status: Ticket["status"] }) => void;
  submitFixRequest: (input: Omit<FixRequest, "id" | "createdAt" | "updatedAt" | "status">) => void;
  submitPermissionRequest: (
    input: Omit<PermissionRequest, "id" | "createdAt" | "updatedAt" | "status">
  ) => void;
  clearDatabase: () => void;
  seedFakeData: () => Promise<void>;
  getOutboxSize: () => number;
}

const FREE_DAILY_SYNC_LIMIT = 10;
const fallbackKsId = (email: string): string =>
  `ks_fallback_${email.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
const toFrontendRole = (role: KeystoneUserRecord["role"]): UserRole => {
  if (role === "superAdmin") return "super_admin";
  if (role === "landlord") return "landlord";
  return "tenant";
};

const withEntityMeta = <T extends object>(prefix: string, input: T) => ({
  ...input,
  id: createId(prefix),
  createdAt: nowIso(),
  updatedAt: nowIso()
});

const createMutation = (
  entity: SyncMutation["entity"],
  payload: unknown,
  action: SyncMutation["action"] = "create"
): SyncMutation => ({
  mutationId: createId("mut"),
  entity,
  action,
  payload,
  timestamp: nowIso(),
  retries: 0,
  status: "queued"
});

const fakeUpload = (): MediaUploadStub => ({
  fileName: "proof-placeholder.jpg",
  mimeType: "image/jpeg",
  byteSize: 1,
  localObjectUrl: PROOF_IMAGE_PLACEHOLDER_URL,
  keystoneFileId: undefined
});

const fakeSeededUpload = (input: {
  landlordId: string;
  propertyId: string;
  category: string;
  index: number;
}): MediaUploadStub => {
  const seed = `${input.landlordId}-${input.propertyId}-${input.category}-${input.index}`.replace(
    /[^a-zA-Z0-9_-]/g,
    "_"
  );
  return {
    fileName: `${input.category}-${input.index}.jpg`,
    mimeType: "image/jpeg",
    byteSize: 128_000,
    localObjectUrl: `https://picsum.photos/seed/${seed}/1200/800`,
    keystoneFileId: `seed_${seed}`
  };
};

const defaultSuperAdmin = (): SuperAdminProfile => ({
  id: "super_admin_default_1",
  fullName: "Demo Super Admin",
  email: "demo.admin@colonus.lat",
  keystoneUserId: fallbackKsId("demo.admin@colonus.lat"),
  createdAt: nowIso(),
  updatedAt: nowIso()
});

const createDefaultPropertyProofSettings = (
  propertyId: string,
  landlordId: string
): PropertyProofSettings =>
  withEntityMeta("proof_policy", {
    propertyId,
    landlordId,
    rentPaymentProof: "optional" as const,
    servicePaymentProof: "optional" as const,
    careProof: "optional" as const
  });

const createDefaultPropertySubscription = (
  propertyId: string,
  tier: PlanTier = "free"
): PropertySubscription =>
  withEntityMeta("property_subscription", {
    propertyId,
    tier,
    subscriptionStatus: tier === "free" ? ("trial" as const) : ("active" as const),
    billingProviderId: undefined,
    trialEndsAt: tier === "free" ? nowIso() : undefined
  });

const normalizeProofRequirement = (value: unknown): ProofRequirement => {
  if (value === "required" || value === "optional" || value === "disabled") return value;
  return "optional";
};

const normalizePlanTier = (value: unknown): PlanTier => {
  if (value === "free" || value === "unlimited") return value;
  return "free";
};

const normalizeSubscriptionStatus = (value: unknown): SubscriptionStatus => {
  if (value === "active" || value === "trial" || value === "past_due" || value === "canceled") {
    return value;
  }
  return "trial";
};

const normalizeLandlordStatus = (value: unknown): Landlord["status"] => {
  if (value === "active" || value === "inactive") return value;
  return "active";
};

const normalizeRentCycleMonths = (value: unknown): RentCycleMonths => {
  if (value === 1 || value === 3 || value === 6 || value === 12) return value;
  if (value === "1" || value === "3" || value === "6" || value === "12") return Number(value) as RentCycleMonths;
  return 1;
};

const normalizeLegacyCycleValue = (value: unknown): RentCycleMonths => {
  if (value === "weekly" || value === "monthly") return 1;
  return normalizeRentCycleMonths(value);
};

const todayKey = (): string => new Date().toISOString().slice(0, 10);

const dayOffsetIso = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

const clamp = (value: number, min: number, max: number): number => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const initialState: ColonusState = {
  superAdmins: [],
  tenants: [],
  landlords: [],
  properties: [],
  propertySubscriptions: [],
  propertyProofSettings: [],
  paymentSubmissions: [],
  careProofSubmissions: [],
  propertyExpenses: [],
  fixRequests: [],
  permissionRequests: [],
  refundRequests: [],
  tickets: [],
  paymentPeriods: []
};

export const useColonusStore = create<ColonusUiState>()(
  persist(
    (set, get) => {
      const propertyTier = (propertyId: string): PlanTier => {
        const subscription = get().propertySubscriptions.find((item) => item.propertyId === propertyId);
        return subscription?.tier ?? "free";
      };

      const registerSyncAttemptForProperty = (propertyId: string): void => {
        const current = get();
        if (propertyTier(propertyId) !== "free") {
          set({ lastSyncNotice: undefined });
          return;
        }

        const today = todayKey();
        const currentUsage = current.syncUsageByProperty[propertyId];
        const currentCount = currentUsage?.date === today ? currentUsage.count : 0;

        if (currentCount >= FREE_DAILY_SYNC_LIMIT) {
          set({
            lastSyncNotice:
              "Cloud sync paused for this property (free tier limit 10/day). Keep working locally, then wait for reset or upgrade."
          });
          return;
        }

        set((state) => ({
          syncUsageByProperty: {
            ...state.syncUsageByProperty,
            [propertyId]: { date: today, count: currentCount + 1 }
          },
          lastSyncNotice: undefined
        }));
      };

      const defaultTheme = defaultThemeColorSelection();

      return {
        ...initialState,
        superAdmins: [defaultSuperAdmin()],
        syncUsageByProperty: {},
        lastSyncNotice: undefined,
        activeRole: "super_admin",
        activeSuperAdminId: "super_admin_default_1",
        themeColorHex: defaultTheme.hex,
        themeHueRotate: defaultTheme.hueRotate,
        devBannerCollapsed: false,
        setActiveRole: (role) =>
          set((state) => {
            if (state.authSession && state.authSession.role !== role) return state;
            return { activeRole: role };
          }),
        selectImpersonationRole: (role) =>
          set((state) => {
            if (state.authSession && state.authSession.role !== role) return state;
            return { impersonationRole: role, activeRole: role };
          }),
        setActiveSuperAdminId: (superAdminId) => set({ activeSuperAdminId: superAdminId }),
        setActiveLandlordId: (landlordId) =>
          set((state) => {
            if (state.authSession?.role === "landlord" && state.authSession.userId !== landlordId) {
              return state;
            }
            return { activeLandlordId: landlordId };
          }),
        setActiveTenantId: (tenantId) =>
          set((state) => {
            if (state.authSession?.role === "tenant" && state.authSession.userId !== tenantId) {
              return state;
            }
            return { activeTenantId: tenantId };
          }),
        setThemeColor: ({ hex, hueRotate }) => set({ themeColorHex: hex, themeHueRotate: hueRotate }),
        setDevBannerCollapsed: (collapsed) => set({ devBannerCollapsed: collapsed }),
        loginWithPassword: async ({ email, password }) => {
          const normalizedEmail = email.trim().toLowerCase();
          if (!normalizedEmail) return { ok: false as const, error: "Email is required." };
          if (!password) {
            return { ok: false as const, error: "Invalid password." };
          }

          let loginResponse: { user: KeystoneUserRecord; firstTimePasswordLink?: string };
          try {
            loginResponse = await loginWithKeystone({ email: normalizedEmail, password });
          } catch (error) {
            return {
              ok: false as const,
              error:
                error instanceof Error
                  ? error.message
                  : "Login failed. Verify API server and credentials."
            };
          }

          const ksUser = loginResponse.user;
          const mappedRole = toFrontendRole(ksUser.role);
          if (mappedRole === "super_admin") {
            let superAdmin = get().superAdmins.find(
              (item) =>
                item.keystoneUserId === ksUser.id || item.email.toLowerCase() === normalizedEmail
            );
            if (!superAdmin) {
              superAdmin = withEntityMeta("superadmin", {
                fullName: ksUser.fullName,
                email: ksUser.email,
                keystoneUserId: ksUser.id
              });
              set((state) => ({ superAdmins: [...state.superAdmins, superAdmin!] }));
            } else if (superAdmin.keystoneUserId !== ksUser.id) {
              set((state) => ({
                superAdmins: state.superAdmins.map((item) =>
                  item.id === superAdmin!.id
                    ? { ...item, keystoneUserId: ksUser.id, updatedAt: nowIso() }
                    : item
                )
              }));
              superAdmin = { ...superAdmin, keystoneUserId: ksUser.id };
            }

            set({
              authSession: {
                role: "super_admin",
                userId: superAdmin.id,
                keystoneUserId: ksUser.id,
                email: superAdmin.email,
                fullName: superAdmin.fullName,
                loggedInAt: nowIso()
              },
              activeRole: "super_admin",
              impersonationRole: "super_admin",
              activeSuperAdminId: superAdmin.id
            });
            return { ok: true as const, role: "super_admin" as const };
          }

          if (mappedRole === "landlord") {
            let landlord = get().landlords.find(
              (item) => item.keystoneUserId === ksUser.id || item.email.toLowerCase() === normalizedEmail
            );
            if (!landlord) {
              return {
                ok: false as const,
                error: "Landlord exists in Keystone but not in local data. Seed local data first."
              };
            }
            if (landlord.keystoneUserId !== ksUser.id) {
              set((state) => ({
                landlords: state.landlords.map((item) =>
                  item.id === landlord!.id
                    ? { ...item, keystoneUserId: ksUser.id, updatedAt: nowIso() }
                    : item
                )
              }));
              landlord = { ...landlord, keystoneUserId: ksUser.id };
            }
            set({
              authSession: {
                role: "landlord",
                userId: landlord.id,
                keystoneUserId: ksUser.id,
                email: landlord.email,
                fullName: landlord.fullName,
                loggedInAt: nowIso()
              },
              activeRole: "landlord",
              impersonationRole: "landlord",
              activeLandlordId: landlord.id
            });
            return {
              ok: true as const,
              role: "landlord" as const,
              requiresPasswordChange: ksUser.mustChangePassword,
              firstTimePasswordToken: ksUser.firstTimePasswordToken
            };
          }

          let tenant = get().tenants.find(
            (item) => item.keystoneUserId === ksUser.id || item.email.toLowerCase() === normalizedEmail
          );
          if (!tenant) {
            return {
              ok: false as const,
              error: "Tenant exists in Keystone but not in local data. Seed local data first."
            };
          }
          if (tenant.keystoneUserId !== ksUser.id) {
            set((state) => ({
              tenants: state.tenants.map((item) =>
                item.id === tenant!.id ? { ...item, keystoneUserId: ksUser.id, updatedAt: nowIso() } : item
              )
            }));
            tenant = { ...tenant, keystoneUserId: ksUser.id };
          }
          if (tenant) {
            set({
              authSession: {
                role: "tenant",
                userId: tenant.id,
                keystoneUserId: ksUser.id,
                email: tenant.email,
                fullName: tenant.fullName,
                loggedInAt: nowIso()
              },
              activeRole: "tenant",
              impersonationRole: "tenant",
              activeTenantId: tenant.id
            });
            return {
              ok: true as const,
              role: "tenant" as const,
              requiresPasswordChange: ksUser.mustChangePassword,
              firstTimePasswordToken: ksUser.firstTimePasswordToken
            };
          }

          return { ok: false as const, error: "User not found. Seed fake data or use existing accounts." };
        },
        logout: () =>
          set((state) => ({
            ...state,
            authSession: undefined,
            impersonationRole: undefined
          })),
        addTenant: async (input) => {
          const ksUser = await provisionKeystoneUser({
            email: input.email.trim().toLowerCase(),
            fullName: input.fullName.trim(),
            phone: input.phone,
            role: "tenant"
          });
          const record = withEntityMeta("tenant", { ...input, keystoneUserId: ksUser.user.id });
          set((state) => ({ tenants: [...state.tenants, record], activeTenantId: record.id }));
          enqueueMutation(createMutation("tenant", record));
          registerSyncAttemptForProperty(record.propertyId);
          return record;
        },
        addLandlord: async (input) => {
          const ksUser = await provisionKeystoneUser({
            email: input.email.trim().toLowerCase(),
            fullName: input.fullName.trim(),
            phone: input.phone,
            role: "landlord"
          });
          const record = withEntityMeta("landlord", {
            ...input,
            keystoneUserId: ksUser.user.id,
            status: "active" as const,
            credentialsSentAt: undefined
          });
          set((state) => ({ landlords: [...state.landlords, record], activeLandlordId: record.id }));
          enqueueMutation(createMutation("landlord", record));
          return record;
        },
        addProperty: (input) => {
          const record = withEntityMeta("property", input);
          const proofSettings = createDefaultPropertyProofSettings(record.id, record.landlordId);
          const subscription = createDefaultPropertySubscription(record.id, "free");
          set((state) => ({
            properties: [...state.properties, record],
            propertyProofSettings: [...state.propertyProofSettings, proofSettings],
            propertySubscriptions: [...state.propertySubscriptions, subscription]
          }));
          enqueueMutation(createMutation("property", record));
          enqueueMutation(createMutation("property_proof_settings", proofSettings));
          enqueueMutation(createMutation("property_subscription", subscription));
          registerSyncAttemptForProperty(record.id);
          return record;
        },
        updateLandlord: ({
          landlordId,
          fullName,
          email,
          phone,
          paymentSubmissionFrequency,
          proofSubmissionFrequency
        }) => {
          let payload: Landlord | undefined;
          set((state) => ({
            ...state,
            landlords: state.landlords.map((landlord) => {
              if (landlord.id !== landlordId) return landlord;
              payload = {
                ...landlord,
                fullName,
                email,
                phone,
                paymentSubmissionFrequency,
                proofSubmissionFrequency,
                updatedAt: nowIso()
              };
              return payload;
            })
          }));
          if (payload) enqueueMutation(createMutation("landlord", payload, "update"));
        },
        setLandlordStatus: ({ landlordId, status }) => {
          let payload: Landlord | undefined;
          set((state) => ({
            ...state,
            landlords: state.landlords.map((landlord) => {
              if (landlord.id !== landlordId) return landlord;
              payload = { ...landlord, status, updatedAt: nowIso() };
              return payload;
            })
          }));
          if (payload) enqueueMutation(createMutation("landlord", payload, "update"));
        },
        setLandlordTier: ({ landlordId, tier, subscriptionStatus }) => {
          const properties = get().properties.filter((property) => property.landlordId === landlordId);
          properties.forEach((property) => {
            get().setPropertySubscriptionTier({
              propertyId: property.id,
              tier,
              subscriptionStatus,
              billingProviderId: tier === "unlimited" ? `sub_${property.id}` : undefined,
              trialEndsAt: tier === "free" ? dayOffsetIso(14) : undefined
            });
          });
        },
        markLandlordCredentialsSent: (landlordId) => {
          let payload: Landlord | undefined;
          set((state) => ({
            ...state,
            landlords: state.landlords.map((landlord) => {
              if (landlord.id !== landlordId) return landlord;
              payload = { ...landlord, credentialsSentAt: nowIso(), updatedAt: nowIso() };
              return payload;
            })
          }));
          if (payload) enqueueMutation(createMutation("landlord", payload, "update"));
        },
        setPropertySubscriptionTier: ({
          propertyId,
          tier,
          subscriptionStatus,
          billingProviderId,
          trialEndsAt
        }) => {
          let payload: PropertySubscription | undefined;
          let action: SyncMutation["action"] = "update";

          set((state) => {
            const existing = state.propertySubscriptions.find((item) => item.propertyId === propertyId);
            const base = existing ?? createDefaultPropertySubscription(propertyId, tier);
            action = existing ? "update" : "create";

            payload = {
              ...base,
              tier,
              subscriptionStatus,
              billingProviderId,
              trialEndsAt,
              updatedAt: nowIso()
            };

            return {
              ...state,
              propertySubscriptions: existing
                ? state.propertySubscriptions.map((item) =>
                    item.propertyId === propertyId ? payload! : item
                  )
                : [...state.propertySubscriptions, payload!]
            };
          });

          if (payload) enqueueMutation(createMutation("property_subscription", payload, action));
        },
        updateTenantSettings: ({ tenantId, rentCycleMonths, rentAmountCents, propertyId }) => {
          let payload: Tenant | undefined;
          set((state) => ({
            ...state,
            tenants: state.tenants.map((tenant) => {
              if (tenant.id !== tenantId) return tenant;
              payload = {
                ...tenant,
                rentCycleMonths,
                rentAmountCents,
                propertyId,
                updatedAt: nowIso()
              };
              return payload;
            })
          }));
          if (payload) enqueueMutation(createMutation("tenant", payload, "update"));
          registerSyncAttemptForProperty(propertyId);
        },
        updatePropertySettings: ({ propertyId, name, address, unitCode, monthlyRentCents }) => {
          let payload: Property | undefined;
          set((state) => ({
            ...state,
            properties: state.properties.map((property) => {
              if (property.id !== propertyId) return property;
              payload = { ...property, name, address, unitCode, monthlyRentCents, updatedAt: nowIso() };
              return payload;
            })
          }));
          if (payload) enqueueMutation(createMutation("property", payload, "update"));
          registerSyncAttemptForProperty(propertyId);
        },
        setPropertyProofRequirement: ({ propertyId, field, requirement }) => {
          let payload: PropertyProofSettings | undefined;
          let action: SyncMutation["action"] = "update";

          set((state) => {
            const property = state.properties.find((item) => item.id === propertyId);
            if (!property) return state;

            const existing = state.propertyProofSettings.find((item) => item.propertyId === propertyId);
            const base = existing ?? createDefaultPropertyProofSettings(property.id, property.landlordId);
            action = existing ? "update" : "create";

            payload = { ...base, [field]: requirement, updatedAt: nowIso() };

            return {
              ...state,
              propertyProofSettings: existing
                ? state.propertyProofSettings.map((item) =>
                    item.propertyId === propertyId ? payload! : item
                  )
                : [...state.propertyProofSettings, payload!]
            };
          });

          if (payload) enqueueMutation(createMutation("property_proof_settings", payload, action));
          registerSyncAttemptForProperty(propertyId);
        },
        submitPayment: (input) => {
          const record = withEntityMeta("payment", {
            ...input,
            submittedAt: nowIso(),
            status: "pending" as const,
            syncStatus: "queued" as const,
            proof: input.proof ?? fakeUpload()
          });
          set((state) => ({ paymentSubmissions: [...state.paymentSubmissions, record] }));
          enqueueMutation(createMutation("payment_submission", record));
          registerSyncAttemptForProperty(record.propertyId);
        },
        submitCareProof: (input) => {
          const record = withEntityMeta("care", {
            ...input,
            submittedAt: nowIso(),
            status: "pending" as const,
            syncStatus: "queued" as const,
            proof: input.proof ?? fakeUpload()
          });
          set((state) => ({ careProofSubmissions: [...state.careProofSubmissions, record] }));
          enqueueMutation(createMutation("care_proof_submission", record));
          registerSyncAttemptForProperty(record.propertyId);
        },
        approvePayment: (paymentId) => {
          const payment = get().paymentSubmissions.find((item) => item.id === paymentId);
          set((state) => ({
            paymentSubmissions: state.paymentSubmissions.map((item) =>
              item.id === paymentId
                ? { ...item, status: "approved" as const, rejectionReason: undefined, updatedAt: nowIso() }
                : item
            )
          }));
          enqueueMutation(createMutation("payment_submission", { paymentId, status: "approved" }, "update"));
          if (payment) registerSyncAttemptForProperty(payment.propertyId);
        },
        rejectPayment: ({ paymentId, reason }) => {
          const trimmedReason = reason.trim();
          if (!trimmedReason) return;
          const payment = get().paymentSubmissions.find((item) => item.id === paymentId);

          set((state) => ({
            paymentSubmissions: state.paymentSubmissions.map((item) =>
              item.id === paymentId
                ? { ...item, status: "rejected" as const, rejectionReason: trimmedReason, updatedAt: nowIso() }
                : item
            )
          }));
          enqueueMutation(
            createMutation(
              "payment_submission",
              { paymentId, status: "rejected", rejectionReason: trimmedReason },
              "update"
            )
          );
          if (payment) registerSyncAttemptForProperty(payment.propertyId);
        },
        approveConditionProof: (careProofId) => {
          const proof = get().careProofSubmissions.find((item) => item.id === careProofId);
          set((state) => ({
            careProofSubmissions: state.careProofSubmissions.map((item) =>
              item.id === careProofId
                ? {
                    ...item,
                    status: "approved" as const,
                    rejectionReason: undefined,
                    updatedAt: nowIso()
                  }
                : item
            )
          }));
          enqueueMutation(
            createMutation("care_proof_submission", { careProofId, status: "approved" }, "update")
          );
          if (proof) registerSyncAttemptForProperty(proof.propertyId);
        },
        rejectConditionProof: ({ careProofId, reason }) => {
          const trimmedReason = reason.trim();
          if (!trimmedReason) return;
          const proof = get().careProofSubmissions.find((item) => item.id === careProofId);
          set((state) => ({
            careProofSubmissions: state.careProofSubmissions.map((item) =>
              item.id === careProofId
                ? {
                    ...item,
                    status: "rejected" as const,
                    rejectionReason: trimmedReason,
                    updatedAt: nowIso()
                  }
                : item
            )
          }));
          enqueueMutation(
            createMutation(
              "care_proof_submission",
              { careProofId, status: "rejected", rejectionReason: trimmedReason },
              "update"
            )
          );
          if (proof) registerSyncAttemptForProperty(proof.propertyId);
        },
        addPropertyExpense: (input) => {
          const record = withEntityMeta("expense", input);
          set((state) => ({ propertyExpenses: [...state.propertyExpenses, record] }));
          enqueueMutation(createMutation("property_expense", record));
          registerSyncAttemptForProperty(record.propertyId);
        },
        createPaymentPeriod: ({ landlordId, propertyId, label, durationMonths, startDate, endDate, dueDay }) => {
          const record = withEntityMeta("payment_period", {
            landlordId,
            propertyId,
            label,
            durationMonths,
            startDate,
            endDate,
            dueDay
          });
          set((state) => ({ paymentPeriods: [...state.paymentPeriods, record] }));
          enqueueMutation(createMutation("payment_period", record));
          return record;
        },
        submitRefundRequest: (input) => {
          const record = withEntityMeta("refund", {
            ...input,
            status: "submitted" as const,
            syncStatus: "queued" as const
          });
          set((state) => ({ refundRequests: [...state.refundRequests, record] }));
          enqueueMutation(createMutation("refund_request", record));
          registerSyncAttemptForProperty(record.propertyId);
        },
        reviewRefundRequest: ({ refundRequestId, status, decisionNote }) => {
          const trimmedNote = decisionNote.trim();
          const refund = get().refundRequests.find((item) => item.id === refundRequestId);
          set((state) => ({
            refundRequests: state.refundRequests.map((item) =>
              item.id === refundRequestId
                ? { ...item, status, decisionNote: trimmedNote || undefined, updatedAt: nowIso() }
                : item
            )
          }));
          enqueueMutation(
            createMutation(
              "refund_request",
              { refundRequestId, status, decisionNote: trimmedNote || undefined },
              "update"
            )
          );
          if (refund) registerSyncAttemptForProperty(refund.propertyId);
        },
        createTicket: (input) => {
          const record = withEntityMeta("ticket", {
            ...input,
            status: "open" as const,
            syncStatus: "queued" as const
          });
          set((state) => ({ tickets: [...state.tickets, record] }));
          enqueueMutation(createMutation("ticket", record));
          registerSyncAttemptForProperty(record.propertyId);
        },
        updateTicketStatus: ({ ticketId, status }) => {
          const ticket = get().tickets.find((item) => item.id === ticketId);
          set((state) => ({
            tickets: state.tickets.map((item) =>
              item.id === ticketId ? { ...item, status, updatedAt: nowIso() } : item
            )
          }));
          enqueueMutation(createMutation("ticket", { ticketId, status }, "update"));
          if (ticket) registerSyncAttemptForProperty(ticket.propertyId);
        },
        submitFixRequest: (input) => {
          const record = withEntityMeta("fix", { ...input, status: "open" as const });
          set((state) => ({ fixRequests: [...state.fixRequests, record] }));
          enqueueMutation(createMutation("fix_request", record));
          registerSyncAttemptForProperty(record.propertyId);
        },
        submitPermissionRequest: (input) => {
          const record = withEntityMeta("perm", { ...input, status: "pending" as const });
          set((state) => ({ permissionRequests: [...state.permissionRequests, record] }));
          enqueueMutation(createMutation("permission_request", record));
          registerSyncAttemptForProperty(record.propertyId);
        },
        clearDatabase: () => {
          clearOutbox();
          clearChangeLog();
          clearTenantGrades();
          set((state) => ({
            ...state,
            authSession: undefined,
            superAdmins: [defaultSuperAdmin()],
            landlords: [],
            tenants: [],
            properties: [],
            propertySubscriptions: [],
            propertyProofSettings: [],
            syncUsageByProperty: {},
            lastSyncNotice: undefined,
            paymentSubmissions: [],
            careProofSubmissions: [],
            propertyExpenses: [],
            fixRequests: [],
            permissionRequests: [],
            refundRequests: [],
            tickets: [],
            paymentPeriods: [],
            activeSuperAdminId: "super_admin_default_1",
            activeLandlordId: undefined,
            activeTenantId: undefined
          }));
        },
        seedFakeData: async () => {
          clearOutbox();
          clearChangeLog();
          clearTenantGrades();
          const seededSuperAdmin = withEntityMeta("superadmin", {
            fullName: "Demo Super Admin",
            email: "demo.admin@colonus.lat",
            keystoneUserId: fallbackKsId("demo.admin@colonus.lat")
          });
          const firstNames = [
            "Ava",
            "Noah",
            "Mia",
            "Liam",
            "Nora",
            "Leo",
            "Ivy",
            "Owen",
            "Sofia",
            "Ezra",
            "Luna",
            "Mason"
          ];
          const lastNames = [
            "Stone",
            "Rivera",
            "Lopez",
            "Turner",
            "Wright",
            "Young",
            "Baker",
            "Brooks",
            "Price",
            "Fisher"
          ];
          const streets = ["Maple", "Oak", "Cedar", "River", "Hill", "Lake", "Park", "Elm"];

          const landlords: Landlord[] = [];
          const properties: Property[] = [];
          const propertySubscriptions: PropertySubscription[] = [];
          const propertyProofSettings: PropertyProofSettings[] = [];
          const tenants: Tenant[] = [];
          const paymentSubmissions: PaymentSubmission[] = [];
          const careProofSubmissions: CareProofSubmission[] = [];
          const propertyExpenses: PropertyExpense[] = [];
          const fixRequests: FixRequest[] = [];
          const permissionRequests: PermissionRequest[] = [];
          const refundRequests: RefundRequest[] = [];
          const tickets: Ticket[] = [];
          const paymentPeriods: PaymentPeriod[] = [];
          const tenantGrades: TenantGrade[] = [];

          for (let i = 0; i < 16; i += 1) {
            const landlord = withEntityMeta("landlord", {
              fullName: `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`,
              email: `landlord${i + 1}@demo.local`,
              phone: `555-20${String(i).padStart(2, "0")}-100${i % 10}`,
              status: i % 6 === 0 ? ("inactive" as const) : ("active" as const),
              credentialsSentAt: i % 3 === 0 ? dayOffsetIso(-(i + 1)) : undefined,
              paymentSubmissionFrequency: ([1, 3, 6, 12][i % 4] ?? 1) as RentCycleMonths,
              proofSubmissionFrequency: ([1, 3, 6, 12][(i + 1) % 4] ?? 1) as RentCycleMonths
            });
            landlords.push(landlord);

            const propertyCount = 2 + (i % 3);
            for (let p = 0; p < propertyCount; p += 1) {
              const propertyIndex = properties.length;
              const property = withEntityMeta("property", {
                landlordId: landlord.id,
                name: `${streets[propertyIndex % streets.length]} Residences ${propertyIndex + 1}`,
                address: `${120 + propertyIndex} ${streets[(propertyIndex + 2) % streets.length]} St`,
                unitCode: `${String.fromCharCode(65 + (propertyIndex % 5))}-${(propertyIndex % 18) + 1}`,
                monthlyRentCents: 120000 + (propertyIndex % 8) * 18000
              });
              properties.push(property);

              const isUnlimited = propertyIndex % 4 === 0;
              propertySubscriptions.push(
                withEntityMeta("property_subscription", {
                  propertyId: property.id,
                  tier: isUnlimited ? ("unlimited" as const) : ("free" as const),
                  subscriptionStatus: isUnlimited
                    ? ("active" as const)
                    : ((["trial", "active", "past_due", "canceled"][propertyIndex % 4] ??
                        "trial") as SubscriptionStatus),
                  billingProviderId: isUnlimited ? `sub_live_${property.id}` : undefined,
                  trialEndsAt: !isUnlimited ? dayOffsetIso(14 - (propertyIndex % 14)) : undefined
                })
              );

              propertyProofSettings.push(
                withEntityMeta("proof_policy", {
                  propertyId: property.id,
                  landlordId: landlord.id,
                  rentPaymentProof: (["required", "optional", "required"][propertyIndex % 3] ??
                    "optional") as ProofRequirement,
                  servicePaymentProof: (["optional", "disabled", "required"][propertyIndex % 3] ??
                    "optional") as ProofRequirement,
                  careProof: (["optional", "required", "disabled"][propertyIndex % 3] ??
                    "optional") as ProofRequirement
                })
              );

            propertyExpenses.push(
              withEntityMeta("expense", {
                landlordId: landlord.id,
                propertyId: property.id,
                title: ["Plumbing", "Paint", "Cleaning", "Electric"][propertyIndex % 4],
                amountCents: 9000 + (propertyIndex % 6) * 6500,
                incurredAt: dayOffsetIso(-(propertyIndex % 30))
              })
            );

            if (p === 0) {
              const start = new Date();
              start.setDate(1);
              start.setMonth(start.getMonth() - (i % 3));
              const cycleDurationMonths = ([1, 3, 6, 12][i % 4] ?? 1) as 1 | 3 | 6 | 12;
              const end = new Date(start);
              end.setMonth(end.getMonth() + cycleDurationMonths, 0);
              paymentPeriods.push(
                withEntityMeta("payment_period", {
                  landlordId: landlord.id,
                  propertyId: property.id,
                  label: `${cycleDurationMonths} Month${cycleDurationMonths > 1 ? "s" : ""} (${start.toLocaleDateString("en-US")} - ${end.toLocaleDateString("en-US")})`,
                  durationMonths: cycleDurationMonths,
                  startDate: start.toISOString(),
                  endDate: end.toISOString(),
                  dueDay: (Math.max(1, Math.min(28, (propertyIndex % 28) + 1)) as number)
                })
              );

              const nextCycleStart = new Date(start);
              nextCycleStart.setMonth(nextCycleStart.getMonth() + cycleDurationMonths, 1);
              const nextCycleEnd = new Date(nextCycleStart);
              nextCycleEnd.setMonth(nextCycleEnd.getMonth() + cycleDurationMonths, 0);
              paymentPeriods.push(
                withEntityMeta("payment_period", {
                  landlordId: landlord.id,
                  propertyId: property.id,
                  label: `${cycleDurationMonths} Month${cycleDurationMonths > 1 ? "s" : ""} (${nextCycleStart.toLocaleDateString("en-US")} - ${nextCycleEnd.toLocaleDateString("en-US")})`,
                  durationMonths: cycleDurationMonths,
                  startDate: nextCycleStart.toISOString(),
                  endDate: nextCycleEnd.toISOString(),
                  dueDay: (Math.max(1, Math.min(28, (propertyIndex % 28) + 1)) as number)
                })
              );
            }
          }
          }

          const targetTenants = 110;
          for (let i = 0; i < targetTenants; i += 1) {
            const property = properties[i % properties.length];
            const landlord = landlords.find((item) => item.id === property.landlordId);
            if (!landlord) continue;

            const tenant = withEntityMeta("tenant", {
              fullName: `${firstNames[(i + 3) % firstNames.length]} ${lastNames[(i + 5) % lastNames.length]}`,
              email: `tenant${i + 1}@demo.local`,
              phone: `555-10${String(i).padStart(2, "0")}-${String(2000 + i).slice(-4)}`,
              landlordId: landlord.id,
              propertyId: property.id,
              rentCycleMonths: ([1, 3, 6, 12][i % 4] ?? 1) as RentCycleMonths,
              rentAmountCents: clamp(property.monthlyRentCents - (i % 7) * 5000, 70000, 350000)
            });
            tenants.push(tenant);

            if (i % 4 !== 0) {
              const score = [4.8, 4.2, 3.6, 2.9, 2.2][i % 5] ?? 3;
              const reasons = [
                ["On-time payments", "Communication"],
                ["Care of property"],
                ["Communication", "Other"],
                ["Noise/complaints", "Communication"],
                ["On-time payments", "Care of property"]
              ][i % 5] as TenantGrade["reasons"];
              tenantGrades.push({
                id: createId("tenant_grade"),
                propertyId: property.id,
                tenantId: tenant.id,
                score,
                reasons,
                note:
                  i % 5 === 3
                    ? "Needs reminders about building quiet hours."
                    : i % 5 === 0
                      ? "Consistent and proactive tenant."
                      : undefined,
                createdByUserId: landlord.id,
                createdAt: dayOffsetIso(-(i % 45) - 2),
                updatedAt: dayOffsetIso(-(i % 18)),
                version: 1 + (i % 3)
              });
            }

            paymentSubmissions.push(
              withEntityMeta("payment", {
                tenantId: tenant.id,
                propertyId: property.id,
                amountCents: tenant.rentAmountCents,
                kind: "rent" as const,
                submittedAt: dayOffsetIso(-(i % 20)),
                datePaid: dayOffsetIso(-(i % 20)),
                paymentMethod: "bank_transfer" as const,
                note: "Rent receipt",
                proof: fakeSeededUpload({
                  landlordId: landlord.id,
                  propertyId: property.id,
                  category: "receipts",
                  index: i
                }),
                syncStatus: i % 3 === 1 ? ("queued" as const) : ("synced" as const),
                status: (["approved", "pending", "rejected"][i % 3] ?? "pending") as
                  | "approved"
                  | "pending"
                  | "rejected",
                rejectionReason: i % 3 === 2 ? "Proof image is blurry. Please resubmit." : undefined
              })
            );

            if (i % 2 === 0) {
              paymentSubmissions.push(
                withEntityMeta("payment", {
                  tenantId: tenant.id,
                  propertyId: property.id,
                  amountCents: clamp(Math.round(tenant.rentAmountCents * 0.15), 9000, 80000),
                  kind: "service" as const,
                  submittedAt: dayOffsetIso(-(i % 11)),
                  datePaid: dayOffsetIso(-(i % 11)),
                  paymentMethod: "card" as const,
                  serviceType: (["water", "light", "internet", "gas", "other"][i % 5] ??
                    "other") as "water" | "light" | "internet" | "gas" | "other",
                  servicePeriod: dayOffsetIso(-(i % 90)).slice(0, 7),
                  proof: fakeSeededUpload({
                    landlordId: landlord.id,
                    propertyId: property.id,
                    category: "service-payments",
                    index: i
                  }),
                  syncStatus: i % 4 === 1 ? ("queued" as const) : ("synced" as const),
                  status: (["approved", "pending", "rejected", "approved"][i % 4] ?? "pending") as
                    | "approved"
                    | "pending"
                    | "rejected",
                  rejectionReason: i % 4 === 2 ? "Invalid receipt total." : undefined
                })
              );
            }

            if (i % 4 === 0) {
              careProofSubmissions.push(
                withEntityMeta("care", {
                  tenantId: tenant.id,
                  propertyId: property.id,
                  submittedAt: dayOffsetIso(-(i % 9)),
                  category: (["move_in", "incident", "maintenance_before", "maintenance_after"][
                    i % 4
                  ] ?? "incident") as "move_in" | "incident" | "maintenance_before" | "maintenance_after",
                  attachments: [
                    fakeSeededUpload({
                      landlordId: landlord.id,
                      propertyId: property.id,
                      category: "care-proof",
                      index: i
                    })
                  ],
                  note: "Routine maintenance done.",
                  proof: fakeSeededUpload({
                    landlordId: landlord.id,
                    propertyId: property.id,
                    category: "care-proof",
                    index: i + 1000
                  }),
                  syncStatus: i % 8 === 0 ? ("synced" as const) : ("queued" as const),
                  status: i % 8 === 0 ? ("approved" as const) : ("pending" as const)
                })
              );
            }
            if (i % 7 === 0) {
              const refundStatus = ([
                "submitted",
                "in_review",
                "approved",
                "rejected",
                "partially_approved"
              ][i % 5] ?? "submitted") as
                | "submitted"
                | "in_review"
                | "approved"
                | "rejected"
                | "partially_approved";
              refundRequests.push(
                withEntityMeta("refund", {
                  tenantId: tenant.id,
                  propertyId: property.id,
                  reasonCategory: (["deposit", "overpayment", "service", "other"][i % 4] ??
                    "other") as "deposit" | "overpayment" | "service" | "other",
                  explanation: "Requesting refund due to overcharge reconciliation.",
                  amountRequestedCents: 12000 + (i % 3) * 4000,
                  attachments: [
                    fakeSeededUpload({
                      landlordId: landlord.id,
                      propertyId: property.id,
                      category: "refund-requests",
                      index: i
                    })
                  ],
                  status: refundStatus,
                  decisionNote:
                    refundStatus === "approved"
                      ? "Approved in full."
                      : refundStatus === "partially_approved"
                        ? "Approved partially based on policy."
                        : refundStatus === "rejected"
                          ? "Rejected due to missing support documentation."
                          : undefined,
                  syncStatus: i % 2 === 0 ? ("synced" as const) : ("queued" as const)
                })
              );
            }
            if (i % 5 === 0) {
              tickets.push(
                withEntityMeta("ticket", {
                  propertyId: property.id,
                  createdByTenantId: tenant.id,
                  category: (["maintenance", "billing", "rules", "other"][i % 4] ??
                    "other") as "maintenance" | "billing" | "rules" | "other",
                  priority: (["low", "medium", "high"][i % 3] ?? "medium") as
                    | "low"
                    | "medium"
                    | "high",
                  title: "Tenant support ticket",
                  description: "Need assistance with a property-related issue.",
                  attachments:
                    i % 2 === 0
                      ? [
                          fakeSeededUpload({
                            landlordId: landlord.id,
                            propertyId: property.id,
                            category: "tickets",
                            index: i
                          })
                        ]
                      : [],
                  status: (["open", "in_progress", "resolved", "closed"][i % 4] ??
                    "open") as "open" | "in_progress" | "resolved" | "closed",
                  syncStatus: i % 3 === 0 ? ("queued" as const) : ("synced" as const)
                })
              );
            }
            if (i % 5 === 0) {
              fixRequests.push(
                withEntityMeta("fix", {
                  tenantId: tenant.id,
                  propertyId: property.id,
                  title: "Leaking faucet",
                  description: "Kitchen faucet leaks overnight.",
                  status: i % 10 === 0 ? ("in_progress" as const) : ("open" as const)
                })
              );
            }
            if (i % 6 === 0) {
              permissionRequests.push(
                withEntityMeta("perm", {
                  tenantId: tenant.id,
                  propertyId: property.id,
                  question: "Can I repaint the living room wall?",
                  status: i % 12 === 0 ? ("approved" as const) : ("pending" as const)
                })
              );
            }
          }

          // Deterministic demo landlord cases for role/selector testing.
          const demoLandlord1 = withEntityMeta("landlord", {
            fullName: "Demo Landlord 1",
            email: "demo1@colonus.lat",
            phone: "555-3000-0001",
            status: "active" as const,
            credentialsSentAt: dayOffsetIso(-1),
            paymentSubmissionFrequency: 1 as const,
            proofSubmissionFrequency: 1 as const
          });
          landlords.push(demoLandlord1);

          const demoLandlord2 = withEntityMeta("landlord", {
            fullName: "Demo Landlord 2",
            email: "demo2@colonus.lat",
            phone: "555-3000-0002",
            status: "active" as const,
            credentialsSentAt: dayOffsetIso(-1),
            paymentSubmissionFrequency: 3 as const,
            proofSubmissionFrequency: 3 as const
          });
          landlords.push(demoLandlord2);

          const demo2Property = withEntityMeta("property", {
            landlordId: demoLandlord2.id,
            name: "Demo2 Property",
            address: "200 Demo Street",
            unitCode: "D2-1",
            monthlyRentCents: 145000
          });
          properties.push(demo2Property);
          propertySubscriptions.push(
            withEntityMeta("property_subscription", {
              propertyId: demo2Property.id,
              tier: "free" as const,
              subscriptionStatus: "trial" as const,
              billingProviderId: undefined,
              trialEndsAt: dayOffsetIso(14)
            })
          );
          propertyProofSettings.push(
            withEntityMeta("proof_policy", {
              propertyId: demo2Property.id,
              landlordId: demoLandlord2.id,
              rentPaymentProof: "optional" as const,
              servicePaymentProof: "optional" as const,
              careProof: "optional" as const
            })
          );
          {
            const start = new Date();
            start.setDate(1);
            const end = new Date(start);
            end.setMonth(end.getMonth() + 3, 0);
            paymentPeriods.push(
              withEntityMeta("payment_period", {
                landlordId: demoLandlord2.id,
                propertyId: demo2Property.id,
                label: `3 Months (${start.toLocaleDateString("en-US")} - ${end.toLocaleDateString("en-US")})`,
                durationMonths: 3,
                startDate: start.toISOString(),
                endDate: end.toISOString(),
                dueDay: 5
              })
            );
          }

          const demoLandlord3 = withEntityMeta("landlord", {
            fullName: "Demo Landlord 3",
            email: "demo3@colonus.lat",
            phone: "555-3000-0003",
            status: "active" as const,
            credentialsSentAt: dayOffsetIso(-1),
            paymentSubmissionFrequency: 6 as const,
            proofSubmissionFrequency: 6 as const
          });
          landlords.push(demoLandlord3);

          const demo3Properties = [
            withEntityMeta("property", {
              landlordId: demoLandlord3.id,
              name: "Demo3 Property",
              address: "300 Demo Avenue",
              unitCode: "D3-1",
              monthlyRentCents: 160000
            }),
            withEntityMeta("property", {
              landlordId: demoLandlord3.id,
              name: "Demo3 Property North",
              address: "302 Demo Avenue",
              unitCode: "D3-2",
              monthlyRentCents: 178000
            }),
            withEntityMeta("property", {
              landlordId: demoLandlord3.id,
              name: "Demo3 Property Garden",
              address: "310 Demo Avenue",
              unitCode: "D3-3",
              monthlyRentCents: 139000
            })
          ];
          properties.push(...demo3Properties);
          demo3Properties.forEach((property, index) => {
            propertySubscriptions.push(
              withEntityMeta("property_subscription", {
                propertyId: property.id,
                tier: index === 0 ? ("free" as const) : ("unlimited" as const),
                subscriptionStatus: index === 0 ? ("trial" as const) : ("active" as const),
                billingProviderId: undefined,
                trialEndsAt: index === 0 ? dayOffsetIso(14) : undefined
              })
            );
            propertyProofSettings.push(
              withEntityMeta("proof_policy", {
                propertyId: property.id,
                landlordId: demoLandlord3.id,
                rentPaymentProof: "optional" as const,
                servicePaymentProof: "optional" as const,
                careProof: "optional" as const
              })
            );
          });
          {
            const start = new Date();
            start.setDate(1);
            const end = new Date(start);
            end.setMonth(end.getMonth() + 6, 0);
            paymentPeriods.push(
              withEntityMeta("payment_period", {
                landlordId: demoLandlord3.id,
                propertyId: demo3Properties[0].id,
                label: `6 Months (${start.toLocaleDateString("en-US")} - ${end.toLocaleDateString("en-US")})`,
                durationMonths: 6,
                startDate: start.toISOString(),
                endDate: end.toISOString(),
                dueDay: 10
              })
            );
          }

          const demo3Tenant = withEntityMeta("tenant", {
            fullName: "Demo Tenant 3",
            email: "tenant.demo3@colonus.lat",
            phone: "555-3100-0003",
            landlordId: demoLandlord3.id,
            propertyId: demo3Properties[0].id,
            rentCycleMonths: 6 as const,
            rentAmountCents: 160000
          });
          tenants.push(demo3Tenant);
          tenantGrades.push({
            id: createId("tenant_grade"),
            propertyId: demo3Properties[0].id,
            tenantId: demo3Tenant.id,
            score: 4.5,
            reasons: ["On-time payments", "Care of property"],
            note: "Reliable demo tenant with strong payment history.",
            createdByUserId: demoLandlord3.id,
            createdAt: dayOffsetIso(-10),
            updatedAt: dayOffsetIso(-2),
            version: 2
          });

          // Explicit first-time onboarding demo users.
          const firstTimeLandlord = withEntityMeta("landlord", {
            fullName: "First Time Landlord",
            email: "firsttime.landlord@colonus.lat",
            phone: "555-3200-0001",
            status: "active" as const,
            credentialsSentAt: dayOffsetIso(-1),
            paymentSubmissionFrequency: 1 as const,
            proofSubmissionFrequency: 1 as const
          });
          landlords.push(firstTimeLandlord);

          const firstTimeProperty = withEntityMeta("property", {
            landlordId: firstTimeLandlord.id,
            name: "First Time Property",
            address: "400 First Avenue",
            unitCode: "FT-1",
            monthlyRentCents: 132000
          });
          properties.push(firstTimeProperty);
          propertySubscriptions.push(
            withEntityMeta("property_subscription", {
              propertyId: firstTimeProperty.id,
              tier: "free" as const,
              subscriptionStatus: "trial" as const,
              billingProviderId: undefined,
              trialEndsAt: dayOffsetIso(14)
            })
          );
          propertyProofSettings.push(
            withEntityMeta("proof_policy", {
              propertyId: firstTimeProperty.id,
              landlordId: firstTimeLandlord.id,
              rentPaymentProof: "optional" as const,
              servicePaymentProof: "optional" as const,
              careProof: "optional" as const
            })
          );

          const firstTimeTenant = withEntityMeta("tenant", {
            fullName: "First Time Tenant",
            email: "firsttime.tenant@colonus.lat",
            phone: "555-3200-0002",
            landlordId: firstTimeLandlord.id,
            propertyId: firstTimeProperty.id,
            rentCycleMonths: 1 as const,
            rentAmountCents: 132000
          });
          tenants.push(firstTimeTenant);

          const syncUsageByProperty: Record<string, { date: string; count: number }> = {};
          properties.forEach((property, idx) => {
            const subscription = propertySubscriptions.find((item) => item.propertyId === property.id);
            if (!subscription || subscription.tier !== "free") return;
            syncUsageByProperty[property.id] = { date: todayKey(), count: idx % 14 };
          });

          try {
            const skipFirstTimeFlowForEmail = (email: string): boolean =>
              !email.startsWith("firsttime.");
            const ksUsers = await provisionKeystoneUsers([
              {
                email: seededSuperAdmin.email,
                fullName: seededSuperAdmin.fullName,
                role: "superAdmin"
              },
              ...landlords.map((landlord) => ({
                email: landlord.email,
                fullName: landlord.fullName,
                phone: landlord.phone,
                role: "landlord" as const,
                skipFirstTimeFlow: skipFirstTimeFlowForEmail(landlord.email)
              })),
              ...tenants.map((tenant) => ({
                email: tenant.email,
                fullName: tenant.fullName,
                phone: tenant.phone,
                role: "tenant" as const,
                skipFirstTimeFlow: skipFirstTimeFlowForEmail(tenant.email)
              }))
            ]);

            const byEmail = new Map<string, string>();
            ksUsers.forEach((user) => byEmail.set(user.email.toLowerCase(), user.id));
            seededSuperAdmin.keystoneUserId =
              byEmail.get(seededSuperAdmin.email.toLowerCase()) ?? seededSuperAdmin.keystoneUserId;
            landlords.forEach((landlord) => {
              landlord.keystoneUserId = byEmail.get(landlord.email.toLowerCase()) ?? landlord.keystoneUserId;
            });
            tenants.forEach((tenant) => {
              tenant.keystoneUserId = byEmail.get(tenant.email.toLowerCase()) ?? tenant.keystoneUserId;
            });
          } catch (error) {
            console.error("Keystone bulk user provisioning failed during local seed", error);
            seededSuperAdmin.keystoneUserId = fallbackKsId(seededSuperAdmin.email);
            landlords.forEach((landlord) => {
              landlord.keystoneUserId = landlord.keystoneUserId ?? fallbackKsId(landlord.email);
            });
            tenants.forEach((tenant) => {
              tenant.keystoneUserId = tenant.keystoneUserId ?? fallbackKsId(tenant.email);
            });
          }

          set((state) => ({
            ...state,
            authSession: undefined,
            superAdmins: [seededSuperAdmin],
            landlords,
            tenants,
            properties,
            propertySubscriptions,
            propertyProofSettings,
            paymentSubmissions,
            careProofSubmissions,
            propertyExpenses,
            fixRequests,
            permissionRequests,
            refundRequests,
            tickets,
            paymentPeriods,
            syncUsageByProperty,
            lastSyncNotice: undefined,
            activeSuperAdminId: seededSuperAdmin.id,
            activeLandlordId: landlords[0]?.id,
            activeTenantId: tenants[0]?.id
          }));
          setTenantGrades(tenantGrades);

          landlords.forEach((item) => enqueueMutation(createMutation("landlord", item)));
          tenants.forEach((item) => enqueueMutation(createMutation("tenant", item)));
          properties.forEach((item) => enqueueMutation(createMutation("property", item)));
          propertySubscriptions.forEach((item) =>
            enqueueMutation(createMutation("property_subscription", item))
          );
          propertyProofSettings.forEach((item) =>
            enqueueMutation(createMutation("property_proof_settings", item))
          );
          paymentSubmissions.forEach((item) =>
            enqueueMutation(createMutation("payment_submission", item))
          );
          careProofSubmissions.forEach((item) =>
            enqueueMutation(createMutation("care_proof_submission", item))
          );
          propertyExpenses.forEach((item) => enqueueMutation(createMutation("property_expense", item)));
          fixRequests.forEach((item) => enqueueMutation(createMutation("fix_request", item)));
          permissionRequests.forEach((item) =>
            enqueueMutation(createMutation("permission_request", item))
          );
          refundRequests.forEach((item) => enqueueMutation(createMutation("refund_request", item)));
          tickets.forEach((item) => enqueueMutation(createMutation("ticket", item)));
          paymentPeriods.forEach((item) => enqueueMutation(createMutation("payment_period", item)));
        },
        getOutboxSize: () => getOutboxQueue().length
      };
    },
    {
      name: getStorageKeys().state,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState) => {
        const state = persistedState as Partial<ColonusUiState> & {
          syncUsageByActor?: Record<string, { date: string; count: number }>;
        };

        const normalizedProofSettings = (state.propertyProofSettings ?? []).map((settings) => ({
          ...settings,
          rentPaymentProof: normalizeProofRequirement(settings.rentPaymentProof),
          servicePaymentProof: normalizeProofRequirement(settings.servicePaymentProof),
          careProof: normalizeProofRequirement(settings.careProof)
        }));

        const inferredProofSettings = (state.properties ?? [])
          .filter(
            (property) => !normalizedProofSettings.some((settings) => settings.propertyId === property.id)
          )
          .map((property) => createDefaultPropertyProofSettings(property.id, property.landlordId));

        const normalizedPropertySubscriptions = (state.propertySubscriptions ?? []).map((sub) => ({
          ...sub,
          tier: normalizePlanTier(sub.tier),
          subscriptionStatus: normalizeSubscriptionStatus(sub.subscriptionStatus)
        }));

        const inferredSubscriptions = (state.properties ?? [])
          .filter(
            (property) =>
              !normalizedPropertySubscriptions.some((sub) => sub.propertyId === property.id)
          )
          .map((property) => {
            const legacyLandlord = (state.landlords ?? []).find(
              (landlord: Landlord & { planTier?: PlanTier }) => landlord.id === property.landlordId
            ) as (Landlord & { planTier?: PlanTier }) | undefined;
            const legacyTenant = (state.tenants ?? []).find(
              (tenant: Tenant & { planTier?: PlanTier }) => tenant.propertyId === property.id
            ) as (Tenant & { planTier?: PlanTier }) | undefined;
            const inferredTier =
              normalizePlanTier(legacyTenant?.planTier) === "unlimited" ||
              normalizePlanTier(legacyLandlord?.planTier) === "unlimited"
                ? ("unlimited" as const)
                : ("free" as const);
            return createDefaultPropertySubscription(property.id, inferredTier);
          });

        const paymentSubmissions = (state.paymentSubmissions ?? []).map((submission) => ({
          ...submission,
          syncStatus: submission.syncStatus ?? "queued",
          proof: {
            ...(submission.proof ?? fakeUpload()),
            localObjectUrl:
              submission.proof?.localObjectUrl &&
              (submission.proof.localObjectUrl.startsWith("http://") ||
                submission.proof.localObjectUrl.startsWith("https://"))
                ? submission.proof.localObjectUrl
                : PROOF_IMAGE_PLACEHOLDER_URL
          }
        }));

        const careProofSubmissions = (state.careProofSubmissions ?? []).map((submission) => ({
          ...submission,
          syncStatus: submission.syncStatus ?? "queued",
          proof: {
            ...(submission.proof ?? fakeUpload()),
            localObjectUrl:
              submission.proof?.localObjectUrl &&
              (submission.proof.localObjectUrl.startsWith("http://") ||
                submission.proof.localObjectUrl.startsWith("https://"))
                ? submission.proof.localObjectUrl
                : PROOF_IMAGE_PLACEHOLDER_URL
          }
        }));

        const persistedColor = (state as { themeColorHex?: unknown }).themeColorHex;
        const persistedHue = (state as { themeHueRotate?: unknown }).themeHueRotate;
        const legacyTheme = legacyThemeSelection((state as { colorTheme?: unknown }).colorTheme);
        const defaultTheme = defaultThemeColorSelection();

        const normalizedThemeHex =
          typeof persistedColor === "string" && /^#[0-9a-fA-F]{6}$/.test(persistedColor)
            ? persistedColor.toLowerCase()
            : legacyTheme?.hex ?? defaultTheme.hex;
        const normalizedThemeHue =
          typeof persistedHue === "number" && Number.isFinite(persistedHue)
            ? persistedHue
            : legacyTheme?.hueRotate ?? defaultTheme.hueRotate;

        return {
          ...state,
          superAdmins:
            state.superAdmins && state.superAdmins.length > 0 ? state.superAdmins : [defaultSuperAdmin()],
          tenants: (state.tenants ?? []).map((tenant) => ({
            id: tenant.id,
            createdAt: tenant.createdAt,
            updatedAt: tenant.updatedAt,
            clientId: tenant.clientId,
            keystoneUserId: tenant.keystoneUserId,
            fullName: tenant.fullName,
            email: tenant.email,
            phone: tenant.phone,
            landlordId: tenant.landlordId,
            propertyId: tenant.propertyId,
            rentCycleMonths: normalizeLegacyCycleValue(
              (tenant as Tenant & { rentFrequency?: unknown }).rentCycleMonths ??
                (tenant as Tenant & { rentFrequency?: unknown }).rentFrequency
            ),
            rentAmountCents: tenant.rentAmountCents
          })),
          landlords: (state.landlords ?? []).map((landlord) => ({
            id: landlord.id,
            createdAt: landlord.createdAt,
            updatedAt: landlord.updatedAt,
            clientId: landlord.clientId,
            keystoneUserId: landlord.keystoneUserId,
            fullName: landlord.fullName,
            email: landlord.email,
            phone: landlord.phone,
            status: normalizeLandlordStatus((landlord as Landlord & { status?: unknown }).status),
            credentialsSentAt: (landlord as Landlord & { credentialsSentAt?: string }).credentialsSentAt,
            paymentSubmissionFrequency: normalizeLegacyCycleValue(landlord.paymentSubmissionFrequency),
            proofSubmissionFrequency: normalizeLegacyCycleValue(landlord.proofSubmissionFrequency)
          })),
          propertySubscriptions: [...normalizedPropertySubscriptions, ...inferredSubscriptions],
          propertyProofSettings: [...normalizedProofSettings, ...inferredProofSettings],
          paymentSubmissions,
          careProofSubmissions,
          refundRequests: state.refundRequests ?? [],
          tickets: state.tickets ?? [],
          paymentPeriods: state.paymentPeriods ?? [],
          syncUsageByProperty: state.syncUsageByProperty ?? state.syncUsageByActor ?? {},
          lastSyncNotice: state.lastSyncNotice,
          themeColorHex: normalizedThemeHex,
          themeHueRotate: normalizedThemeHue,
          devBannerCollapsed: state.devBannerCollapsed ?? false
        };
      },
      partialize: (state) => ({
        authSession: state.authSession,
        superAdmins: state.superAdmins,
        tenants: state.tenants,
        landlords: state.landlords,
        properties: state.properties,
        propertySubscriptions: state.propertySubscriptions,
        propertyProofSettings: state.propertyProofSettings,
        paymentSubmissions: state.paymentSubmissions,
        careProofSubmissions: state.careProofSubmissions,
        propertyExpenses: state.propertyExpenses,
        fixRequests: state.fixRequests,
        permissionRequests: state.permissionRequests,
        refundRequests: state.refundRequests,
        tickets: state.tickets,
        paymentPeriods: state.paymentPeriods,
        syncUsageByProperty: state.syncUsageByProperty,
        lastSyncNotice: state.lastSyncNotice,
        activeRole: state.activeRole,
        impersonationRole: state.impersonationRole,
        activeSuperAdminId: state.activeSuperAdminId,
        activeLandlordId: state.activeLandlordId,
        activeTenantId: state.activeTenantId,
        themeColorHex: state.themeColorHex,
        themeHueRotate: state.themeHueRotate,
        devBannerCollapsed: state.devBannerCollapsed
      })
    }
  )
);

export const selectLandlordIncome = (state: ColonusUiState, landlordId: string): number => {
  const propertyIds = state.properties.filter((p) => p.landlordId === landlordId).map((p) => p.id);
  return state.paymentSubmissions
    .filter((p) => propertyIds.includes(p.propertyId) && p.status === "approved")
    .reduce((acc, item) => acc + item.amountCents, 0);
};

export const selectLandlordOutcome = (state: ColonusUiState, landlordId: string): number => {
  return state.propertyExpenses
    .filter((expense) => expense.landlordId === landlordId)
    .reduce((acc, item) => acc + item.amountCents, 0);
};
