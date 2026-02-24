export const STORAGE_VERSION = 8;

export const STORAGE_KEYS = {
  version: "COLONUS_STORAGE_VERSION",
  state: "COLONUS_APP_STATE",
  outbox: "COLONUS_OUTBOX",
  tenantGrades: "COLONUS_TENANT_GRADES_STATE",
  changeLog: "COLONUS_CHANGE_LOG",
  syncMeta: "COLONUS_SYNC_META",
  syncPolicyCache: "COLONUS_SYNC_POLICY_CACHE"
} as const;

export const PROOF_IMAGE_PLACEHOLDER_URL = "/placeholders/proof-image.svg";

export type UserRole = "super_admin" | "landlord" | "tenant";
export type SyncPolicyRole = UserRole;
export type SyncPolicyMode = "after_change" | "interval" | "hybrid";
export type ColorTheme = "slate" | "aqua" | "emerald" | "amber" | "rose";
export type PlanTier = "free" | "unlimited";
export type SubscriptionStatus = "active" | "trial" | "past_due" | "canceled";
export type RentCycleMonths = 1 | 3 | 6 | 12;

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  clientId?: string;
}

export interface Tenant extends BaseEntity {
  fullName: string;
  email: string;
  phone?: string;
  keystoneUserId?: string;
  landlordId: string;
  propertyId: string;
  rentCycleMonths: RentCycleMonths;
  rentAmountCents: number;
}

export interface Landlord extends BaseEntity {
  fullName: string;
  email: string;
  phone?: string;
  keystoneUserId?: string;
  status: "active" | "inactive";
  credentialsSentAt?: string;
  paymentSubmissionFrequency: RentCycleMonths;
  proofSubmissionFrequency: RentCycleMonths;
}

export interface SuperAdminProfile extends BaseEntity {
  fullName: string;
  email: string;
  keystoneUserId?: string;
}

export interface Property extends BaseEntity {
  landlordId: string;
  name: string;
  address: string;
  unitCode?: string;
  monthlyRentCents: number;
}

export interface PropertySubscription extends BaseEntity {
  propertyId: string;
  tier: PlanTier;
  subscriptionStatus: SubscriptionStatus;
  billingProviderId?: string;
  trialEndsAt?: string;
}

export type ProofKind = "rent_payment" | "service_payment" | "property_care";
export type ProofRequirement = "optional" | "required" | "disabled";
export const TENANT_GRADE_REASONS = [
  "On-time payments",
  "Communication",
  "Care of property",
  "Noise/complaints",
  "Other"
] as const;
export type TenantGradeReason = (typeof TENANT_GRADE_REASONS)[number];

export interface TenantGrade extends BaseEntity {
  propertyId: string;
  tenantId: string;
  score: number;
  reasons: TenantGradeReason[];
  note?: string;
  createdByUserId: string;
  version: number;
}

export interface PropertyProofSettings extends BaseEntity {
  landlordId: string;
  propertyId: string;
  rentPaymentProof: ProofRequirement;
  servicePaymentProof: ProofRequirement;
  careProof: ProofRequirement;
}

export interface MediaUploadStub {
  fileName: string;
  mimeType: string;
  byteSize: number;
  localObjectUrl: string;
  // Placeholder for future Keystone file id.
  keystoneFileId?: string;
}

export interface PaymentSubmission extends BaseEntity {
  tenantId: string;
  propertyId: string;
  amountCents: number;
  kind: "rent" | "service";
  paymentMethod?: "bank_transfer" | "cash" | "card" | "other";
  datePaid?: string;
  note?: string;
  serviceType?: "water" | "light" | "internet" | "gas" | "other";
  servicePeriod?: string;
  submittedAt: string;
  proof: MediaUploadStub;
  status: "pending" | "approved" | "rejected";
  syncStatus?: "queued" | "synced";
  rejectionReason?: string;
}

export interface CareProofSubmission extends BaseEntity {
  tenantId: string;
  propertyId: string;
  category?: "move_in" | "move_out" | "incident" | "maintenance_before" | "maintenance_after";
  attachments?: MediaUploadStub[];
  submittedAt: string;
  note?: string;
  proof: MediaUploadStub;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  syncStatus?: "queued" | "synced";
}

export interface PropertyExpense extends BaseEntity {
  landlordId: string;
  propertyId: string;
  title: string;
  amountCents: number;
  incurredAt: string;
}

export interface FixRequest extends BaseEntity {
  tenantId: string;
  propertyId: string;
  title: string;
  description: string;
  status: "open" | "in_progress" | "resolved";
}

export interface PermissionRequest extends BaseEntity {
  tenantId: string;
  propertyId: string;
  question: string;
  status: "pending" | "approved" | "rejected";
}

export interface RefundRequest extends BaseEntity {
  tenantId: string;
  propertyId: string;
  reasonCategory: "deposit" | "overpayment" | "service" | "other";
  explanation: string;
  amountRequestedCents?: number;
  attachments?: MediaUploadStub[];
  status: "submitted" | "in_review" | "approved" | "rejected" | "partially_approved";
  decisionNote?: string;
  syncStatus?: "queued" | "synced";
}

export interface Ticket extends BaseEntity {
  propertyId: string;
  createdByTenantId: string;
  category: "maintenance" | "billing" | "rules" | "other";
  priority: "low" | "medium" | "high";
  title: string;
  description: string;
  attachments?: MediaUploadStub[];
  status: "open" | "in_progress" | "resolved" | "closed";
  syncStatus?: "queued" | "synced";
}

export interface PaymentPeriod extends BaseEntity {
  landlordId: string;
  propertyId?: string;
  label: string;
  durationMonths: number;
  startDate: string;
  endDate: string;
  dueDay?: number;
}

export interface ColonusState {
  superAdmins: SuperAdminProfile[];
  tenants: Tenant[];
  landlords: Landlord[];
  properties: Property[];
  propertySubscriptions: PropertySubscription[];
  propertyProofSettings: PropertyProofSettings[];
  paymentSubmissions: PaymentSubmission[];
  careProofSubmissions: CareProofSubmission[];
  propertyExpenses: PropertyExpense[];
  fixRequests: FixRequest[];
  permissionRequests: PermissionRequest[];
  refundRequests: RefundRequest[];
  tickets: Ticket[];
  paymentPeriods: PaymentPeriod[];
}

export interface SyncPolicy {
  id: string;
  role: SyncPolicyRole;
  enabled: boolean;
  mode: SyncPolicyMode;
  delayAfterChangeSeconds: number;
  intervalSeconds: number;
  retryBackoffSeconds: number;
  maxRetryBackoffSeconds: number;
  maxJitterSeconds: number;
  initialHydrationOnLogin: boolean;
  forceSyncOnLogin: boolean;
  devShowCountdown: boolean;
  updatedByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export type EntityKind =
  | "tenant"
  | "landlord"
  | "property"
  | "tenant_grade"
  | "property_subscription"
  | "property_proof_settings"
  | "payment_submission"
  | "care_proof_submission"
  | "property_expense"
  | "fix_request"
  | "permission_request"
  | "refund_request"
  | "ticket"
  | "payment_period";

export type MutationAction = "create" | "update" | "delete";

export interface SyncMutation<TPayload = unknown> {
  mutationId: string;
  entity: EntityKind;
  action: MutationAction;
  timestamp: string;
  payload: TPayload;
  retries: number;
  status: "queued" | "processing" | "failed" | "synced" | "needsReview";
}

export const nowIso = (): string => new Date().toISOString();

export const createId = (prefix: string): string => {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${random}`;
};
