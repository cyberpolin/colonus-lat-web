import { list } from "@keystone-6/core";
import {
  checkbox,
  integer,
  json,
  relationship,
  select,
  text,
  timestamp
} from "@keystone-6/core/fields";

const allowAllAccess = {
  operation: {
    query: () => true,
    create: () => true,
    update: () => true,
    delete: () => true
  }
} as const;

export const lists = {
  User: list({
    access: allowAllAccess,
    fields: {
      email: text({
        validation: { isRequired: true },
        isIndexed: "unique"
      }),
      fullName: text({ validation: { isRequired: true } }),
      phone: text(),
      password: text(),
      mustChangePassword: checkbox({ defaultValue: false }),
      onboardingCompleted: checkbox({ defaultValue: true }),
      firstTimePasswordToken: text(),
      firstTimePasswordTokenExpiresAt: timestamp(),
      welcomeEmailSentAt: timestamp(),
      role: select({
        type: "enum",
        options: [
          { label: "Super Admin", value: "superAdmin" },
          { label: "Landlord", value: "landlord" },
          { label: "Tenant", value: "tenant" }
        ],
        validation: { isRequired: true },
        defaultValue: "tenant"
      }),
      status: select({
        type: "enum",
        options: [
          { label: "Active", value: "active" },
          { label: "Disabled", value: "disabled" }
        ],
        validation: { isRequired: true },
        defaultValue: "active"
      }),
      propertiesOwned: relationship({ ref: "Property.landlord", many: true }),
      memberships: relationship({ ref: "Membership.user", many: true }),
      uploadedAssets: relationship({ ref: "UploadedAsset.landlord", many: true }),
      syncEvents: relationship({ ref: "SyncEvent.actor", many: true }),
      updatedSyncPolicies: relationship({ ref: "SyncPolicy.updatedByUser", many: true }),
      publicListings: relationship({ ref: "PublicPropertyListing.landlord", many: true }),
      rentalInquiries: relationship({ ref: "RentalInquiry.landlord", many: true }),
      createdAt: timestamp({ defaultValue: { kind: "now" } }),
      updatedAt: timestamp({ db: { updatedAt: true } })
    }
  }),

  Property: list({
    access: allowAllAccess,
    fields: {
      landlord: relationship({ ref: "User.propertiesOwned", many: false }),
      name: text({ validation: { isRequired: true } }),
      address: text(),
      unitCode: text(),
      subscription: relationship({ ref: "PropertySubscription.property", many: false }),
      memberships: relationship({ ref: "Membership.property", many: true }),
      uploadedAssets: relationship({ ref: "UploadedAsset.property", many: true }),
      syncEvents: relationship({ ref: "SyncEvent.property", many: true }),
      createdAt: timestamp({ defaultValue: { kind: "now" } }),
      updatedAt: timestamp({ db: { updatedAt: true } })
    }
  }),

  Membership: list({
    access: allowAllAccess,
    fields: {
      user: relationship({ ref: "User.memberships", many: false }),
      property: relationship({ ref: "Property.memberships", many: false }),
      role: select({
        type: "enum",
        options: [
          { label: "Tenant", value: "tenant" },
          { label: "Manager", value: "manager" },
          { label: "Owner", value: "owner" }
        ],
        validation: { isRequired: true },
        defaultValue: "tenant"
      }),
      status: select({
        type: "enum",
        options: [
          { label: "Active", value: "active" },
          { label: "Invited", value: "invited" }
        ],
        validation: { isRequired: true },
        defaultValue: "active"
      }),
      createdAt: timestamp({ defaultValue: { kind: "now" } }),
      updatedAt: timestamp({ db: { updatedAt: true } })
    }
  }),

  PropertySubscription: list({
    access: allowAllAccess,
    fields: {
      property: relationship({ ref: "Property.subscription", many: false }),
      tier: select({
        type: "enum",
        options: [
          { label: "Free", value: "free" },
          { label: "Unlimited", value: "unlimited" }
        ],
        validation: { isRequired: true },
        defaultValue: "free"
      }),
      subscriptionStatus: select({
        type: "enum",
        options: [
          { label: "Trial", value: "trial" },
          { label: "Active", value: "active" },
          { label: "Past Due", value: "past_due" },
          { label: "Canceled", value: "canceled" }
        ],
        validation: { isRequired: true },
        defaultValue: "trial"
      }),
      trialEndsAt: timestamp(),
      createdAt: timestamp({ defaultValue: { kind: "now" } }),
      updatedAt: timestamp({ db: { updatedAt: true } })
    }
  }),

  UploadedAsset: list({
    access: allowAllAccess,
    fields: {
      landlord: relationship({ ref: "User.uploadedAssets", many: false }),
      property: relationship({ ref: "Property.uploadedAssets", many: false }),
      category: text({ validation: { isRequired: true } }),
      secureUrl: text({ validation: { isRequired: true } }),
      publicId: text({ validation: { isRequired: true } }),
      bytes: integer(),
      format: text(),
      resourceType: text(),
      createdAt: timestamp({ defaultValue: { kind: "now" } }),
      updatedAt: timestamp({ db: { updatedAt: true } })
    }
  }),

  SyncEvent: list({
    access: allowAllAccess,
    fields: {
      property: relationship({ ref: "Property.syncEvents", many: false }),
      actor: relationship({ ref: "User.syncEvents", many: false }),
      kind: select({
        type: "enum",
        options: [
          { label: "Upload Asset", value: "upload_asset" },
          { label: "Backup DB", value: "backup_db" },
          { label: "Mutation Push", value: "mutation_push" },
          { label: "Mutation Pull", value: "mutation_pull" },
          { label: "Quota Blocked", value: "quota_blocked" }
        ],
        validation: { isRequired: true }
      }),
      clientSessionId: text(),
      clientStorageVersion: text(),
      counts: json(),
      status: select({
        type: "enum",
        options: [
          { label: "Ok", value: "ok" },
          { label: "Error", value: "error" }
        ],
        validation: { isRequired: true },
        defaultValue: "ok"
      }),
      errorMessage: text(),
      createdAt: timestamp({ defaultValue: { kind: "now" } }),
      updatedAt: timestamp({ db: { updatedAt: true } })
    }
  }),

  SyncPolicy: list({
    access: allowAllAccess,
    fields: {
      role: select({
        type: "enum",
        options: [
          { label: "Super Admin", value: "super_admin" },
          { label: "Landlord", value: "landlord" },
          { label: "Tenant", value: "tenant" }
        ],
        validation: { isRequired: true },
        isIndexed: "unique"
      }),
      enabled: checkbox({ defaultValue: true }),
      mode: select({
        type: "enum",
        options: [
          { label: "After Change", value: "after_change" },
          { label: "Interval", value: "interval" },
          { label: "Hybrid", value: "hybrid" }
        ],
        validation: { isRequired: true },
        defaultValue: "after_change"
      }),
      delayAfterChangeSeconds: integer({ defaultValue: 60 }),
      intervalSeconds: integer({ defaultValue: 300 }),
      retryBackoffSeconds: integer({ defaultValue: 60 }),
      maxRetryBackoffSeconds: integer({ defaultValue: 300 }),
      maxJitterSeconds: integer({ defaultValue: 0 }),
      initialHydrationOnLogin: checkbox({ defaultValue: true }),
      forceSyncOnLogin: checkbox({ defaultValue: false }),
      devShowCountdown: checkbox({ defaultValue: true }),
      updatedByUser: relationship({ ref: "User.updatedSyncPolicies", many: false }),
      createdAt: timestamp({ defaultValue: { kind: "now" } }),
      updatedAt: timestamp({ db: { updatedAt: true } })
    }
  }),

  PublicPropertyListing: list({
    access: allowAllAccess,
    fields: {
      landlord: relationship({ ref: "User.publicListings", many: false }),
      sourcePropertyId: text({ validation: { isRequired: true }, isIndexed: "unique" }),
      slug: text({ validation: { isRequired: true }, isIndexed: "unique" }),
      propertyName: text({ validation: { isRequired: true } }),
      address: text(),
      unitCode: text(),
      headline: text({ validation: { isRequired: true } }),
      description: text(),
      monthlyRentCents: integer({ defaultValue: 0 }),
      currency: text({ defaultValue: "USD" }),
      bedrooms: integer({ defaultValue: 0 }),
      bathrooms: integer({ defaultValue: 0 }),
      areaSqm: integer({ defaultValue: 0 }),
      isAvailable: checkbox({ defaultValue: false }),
      isOffered: checkbox({ defaultValue: false }),
      photos: json(),
      relatedListings: relationship({
        ref: "PublicPropertyListing.relatedFrom",
        many: true
      }),
      relatedFrom: relationship({
        ref: "PublicPropertyListing.relatedListings",
        many: true
      }),
      inquiries: relationship({ ref: "RentalInquiry.listing", many: true }),
      createdAt: timestamp({ defaultValue: { kind: "now" } }),
      updatedAt: timestamp({ db: { updatedAt: true } })
    }
  }),

  RentalInquiry: list({
    access: allowAllAccess,
    fields: {
      listing: relationship({ ref: "PublicPropertyListing.inquiries", many: false }),
      landlord: relationship({ ref: "User.rentalInquiries", many: false }),
      requesterName: text({ validation: { isRequired: true } }),
      requesterEmail: text({ validation: { isRequired: true } }),
      requesterPhone: text(),
      message: text(),
      status: select({
        type: "enum",
        options: [
          { label: "New", value: "new" },
          { label: "Contacted", value: "contacted" },
          { label: "Closed", value: "closed" }
        ],
        validation: { isRequired: true },
        defaultValue: "new"
      }),
      createdAt: timestamp({ defaultValue: { kind: "now" } }),
      updatedAt: timestamp({ db: { updatedAt: true } })
    }
  })
};
