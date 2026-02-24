import type { ColonusState, SyncMutation } from "@colonus/shared";

const FREE_SYNC_DAILY_LIMIT = 10;
const UNLIMITED_PLAN_PRICE_CENTS = 1000;
const STORAGE_COST_PER_GB_USD = 0.023;
const METRICS_SNAPSHOT_STORAGE_KEY = "COLONUS_SUPERADMIN_METRICS_DAILY";

const MS_IN_DAY = 24 * 60 * 60 * 1000;

const parseTime = (value?: string): number => {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const percent = (numerator: number, denominator: number): number => {
  if (denominator <= 0) return 0;
  return (numerator / denominator) * 100;
};

const avg = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((acc, item) => acc + item, 0) / values.length;
};

const estimateAttachmentBytes = (state: ColonusState): number => {
  const paymentProofs = state.paymentSubmissions.length;
  const careProofAttachments = state.careProofSubmissions.reduce(
    (acc, proof) => acc + Math.max(1, proof.attachments?.length ?? 0),
    0
  );
  const refundAttachments = state.refundRequests.reduce((acc, item) => acc + (item.attachments?.length ?? 0), 0);
  const ticketAttachments = state.tickets.reduce((acc, item) => acc + (item.attachments?.length ?? 0), 0);
  const roughTotalFiles = paymentProofs + careProofAttachments + refundAttachments + ticketAttachments;
  const averageFileSizeBytes = 250 * 1024;
  return roughTotalFiles * averageFileSizeBytes;
};

const uniquePropertyCount = (propertyIds: string[]): number => {
  return new Set(propertyIds).size;
};

const formatHoursAgo = (timestamp: number, now: number): string => {
  if (!timestamp) return "No pending syncs";
  const hours = Math.floor((now - timestamp) / (60 * 60 * 1000));
  return `${Math.max(0, hours)}h ago`;
};

export interface MetricItem {
  label: string;
  value: string;
  source: string;
  critical?: boolean;
}

export interface MetricSection {
  title: string;
  items: MetricItem[];
}

export interface FounderMetricsSnapshot {
  generatedAt: string;
  sections: MetricSection[];
  criticalAlerts: string[];
}

interface StoredFounderSnapshot {
  dayKey: string;
  snapshot: FounderMetricsSnapshot;
}

const todayKey = (): string => new Date().toISOString().slice(0, 10);

const readStoredSnapshot = (): StoredFounderSnapshot | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(METRICS_SNAPSHOT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredFounderSnapshot;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.dayKey || !parsed.snapshot) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeStoredSnapshot = (snapshot: StoredFounderSnapshot): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(METRICS_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
};

export const buildFounderMetricsSnapshot = (
  state: ColonusState & { syncUsageByProperty: Record<string, { date: string; count: number }> },
  outboxQueue: SyncMutation[]
): FounderMetricsSnapshot => {
  const now = Date.now();
  const dayAgo = now - MS_IN_DAY;
  const sevenDaysAgo = now - 7 * MS_IN_DAY;
  const fourteenDaysAgo = now - 14 * MS_IN_DAY;
  const twoDaysAgo = now - 2 * MS_IN_DAY;

  const subscriptions = state.propertySubscriptions;

  const unlimitedActive = subscriptions.filter(
    (item) => item.tier === "unlimited" && item.subscriptionStatus === "active"
  );
  const freeProperties = subscriptions.filter((item) => item.tier === "free");
  const trialProperties = subscriptions.filter((item) => item.subscriptionStatus === "trial");
  const pastDueProperties = subscriptions.filter((item) => item.subscriptionStatus === "past_due");

  const mrrCents = unlimitedActive.length * UNLIMITED_PLAN_PRICE_CENTS;
  const atRiskRevenueCents = pastDueProperties.length * UNLIMITED_PLAN_PRICE_CENTS;

  const upgradesLast24h = subscriptions.filter(
    (item) => item.tier === "unlimited" && parseTime(item.updatedAt) >= dayAgo
  ).length;

  const freeToPaidRate = percent(
    subscriptions.filter((item) => item.tier === "unlimited").length,
    subscriptions.length
  );
  const trialToPaidRate = percent(
    subscriptions.filter((item) => item.tier === "unlimited" && item.subscriptionStatus === "active").length,
    subscriptions.filter((item) => item.subscriptionStatus === "trial" || item.subscriptionStatus === "active").length
  );
  const propertiesHitSyncLimitToday = Object.values(state.syncUsageByProperty).filter(
    (usage) => usage.count >= FREE_SYNC_DAILY_LIMIT
  ).length;

  const activityTimestampsByProperty: Record<string, number[]> = {};
  const pushActivity = (propertyId: string, timestamp?: string) => {
    if (!propertyId) return;
    const parsed = parseTime(timestamp);
    if (!parsed) return;
    const current = activityTimestampsByProperty[propertyId] ?? [];
    current.push(parsed);
    activityTimestampsByProperty[propertyId] = current;
  };

  state.paymentSubmissions.forEach((item) => pushActivity(item.propertyId, item.submittedAt));
  state.careProofSubmissions.forEach((item) => pushActivity(item.propertyId, item.submittedAt));
  state.refundRequests.forEach((item) => pushActivity(item.propertyId, item.createdAt));
  state.tickets.forEach((item) => pushActivity(item.propertyId, item.createdAt));
  state.fixRequests.forEach((item) => pushActivity(item.propertyId, item.createdAt));
  state.permissionRequests.forEach((item) => pushActivity(item.propertyId, item.createdAt));
  state.propertyExpenses.forEach((item) => pushActivity(item.propertyId, item.incurredAt));

  const activeProperties7d = state.properties.filter((property) => {
    const timestamps = activityTimestampsByProperty[property.id] ?? [];
    return timestamps.some((timestamp) => timestamp >= sevenDaysAgo);
  }).length;

  const inactiveProperties14d = state.properties.filter((property) => {
    const timestamps = activityTimestampsByProperty[property.id] ?? [];
    if (timestamps.length === 0) return true;
    const mostRecent = Math.max(...timestamps);
    return mostRecent < fourteenDaysAgo;
  }).length;

  const averagePropertiesPerLandlord = state.landlords.length
    ? state.properties.length / state.landlords.length
    : 0;

  const topLandlords = state.landlords
    .map((landlord) => {
      const count = state.properties.filter((property) => property.landlordId === landlord.id).length;
      return { name: landlord.fullName, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((item) => `${item.name} (${item.count})`)
    .join(", ");

  const queueTotal = outboxQueue.length;
  const queueSynced = outboxQueue.filter((item) => item.status === "synced").length;
  const queueRetried = outboxQueue.filter((item) => item.retries > 0).length;
  const queueFailed = outboxQueue.filter(
    (item) => item.status === "failed" || item.status === "needsReview"
  ).length;

  const syncSuccessRate = queueTotal ? percent(queueSynced, queueTotal) : 100;
  const retryRate = queueTotal ? percent(queueRetried, queueTotal) : 0;
  const failedSyncRate = queueTotal ? percent(queueFailed, queueTotal) : 0;

  const queuedPaymentsOver48h = state.paymentSubmissions.filter(
    (item) => item.syncStatus === "queued" && parseTime(item.submittedAt) <= twoDaysAgo
  );
  const queuedCareProofsOver48h = state.careProofSubmissions.filter(
    (item) => item.syncStatus === "queued" && parseTime(item.submittedAt) <= twoDaysAgo
  );
  const queuedRefundsOver48h = state.refundRequests.filter(
    (item) => item.syncStatus === "queued" && parseTime(item.createdAt) <= twoDaysAgo
  );
  const queuedTicketsOver48h = state.tickets.filter(
    (item) => item.syncStatus === "queued" && parseTime(item.createdAt) <= twoDaysAgo
  );
  const propertiesWithUnsynced48h = uniquePropertyCount([
    ...queuedPaymentsOver48h.map((item) => item.propertyId),
    ...queuedCareProofsOver48h.map((item) => item.propertyId),
    ...queuedRefundsOver48h.map((item) => item.propertyId),
    ...queuedTicketsOver48h.map((item) => item.propertyId)
  ]);

  const oldestUnsyncedTimestamp = Math.min(
    ...[
      ...queuedPaymentsOver48h.map((item) => parseTime(item.submittedAt)),
      ...queuedCareProofsOver48h.map((item) => parseTime(item.submittedAt)),
      ...queuedRefundsOver48h.map((item) => parseTime(item.createdAt)),
      ...queuedTicketsOver48h.map((item) => parseTime(item.createdAt))
    ].filter(Boolean)
  );

  const storageBytes = estimateAttachmentBytes(state);
  const storageGB = storageBytes / (1024 * 1024 * 1024);
  const estimatedStorageCostUsd = storageGB * STORAGE_COST_PER_GB_USD;

  const openTickets = state.tickets.filter(
    (item) => item.status === "open" || item.status === "in_progress"
  ).length;
  const recentTickets = state.tickets.filter((item) => parseTime(item.createdAt) >= sevenDaysAgo).length;
  const resolvedDurationsHours = state.tickets
    .filter((item) => item.status === "resolved" || item.status === "closed")
    .map((item) => {
      const created = parseTime(item.createdAt);
      const resolved = parseTime(item.updatedAt);
      if (!created || !resolved || resolved <= created) return 0;
      return (resolved - created) / (60 * 60 * 1000);
    })
    .filter((value) => value > 0);
  const averageResolutionHours = avg(resolvedDurationsHours);

  const criticalAlerts: string[] = [];
  if (pastDueProperties.length > 0) {
    criticalAlerts.push(`${pastDueProperties.length} properties are past due.`);
  }
  if (failedSyncRate >= 5) {
    criticalAlerts.push(`Failed sync rate is ${failedSyncRate.toFixed(1)}%.`);
  }
  if (propertiesWithUnsynced48h > 0) {
    criticalAlerts.push(
      `${propertiesWithUnsynced48h} properties have unsynced data older than 48h (${formatHoursAgo(
        oldestUnsyncedTimestamp,
        now
      )}).`
    );
  }
  if (propertiesHitSyncLimitToday > 0) {
    criticalAlerts.push(`${propertiesHitSyncLimitToday} properties hit free sync limits today.`);
  }

  return {
    generatedAt: new Date(now).toISOString(),
    criticalAlerts,
    sections: [
      {
        title: "Revenue & Monetization",
        items: [
          {
            label: "Monthly Recurring Revenue (MRR)",
            value: `$${(mrrCents / 100).toFixed(2)}`,
            source: "propertySubscriptions where tier=unlimited and subscriptionStatus=active * $10/month"
          },
          {
            label: "Active paid properties",
            value: String(unlimitedActive.length),
            source: "propertySubscriptions filtered by tier=unlimited and subscriptionStatus=active"
          },
          {
            label: "Free properties",
            value: String(freeProperties.length),
            source: "propertySubscriptions filtered by tier=free"
          },
          {
            label: "Trial properties",
            value: String(trialProperties.length),
            source: "propertySubscriptions filtered by subscriptionStatus=trial"
          },
          {
            label: "Past-due properties",
            value: String(pastDueProperties.length),
            source: "propertySubscriptions filtered by subscriptionStatus=past_due",
            critical: pastDueProperties.length > 0
          },
          {
            label: "At-risk revenue",
            value: `$${(atRiskRevenueCents / 100).toFixed(2)}`,
            source: "past_due property count * $10/month",
            critical: atRiskRevenueCents > 0
          }
        ]
      },
      {
        title: "Conversion & Upgrades",
        items: [
          {
            label: "Upgrades in last 24h",
            value: String(upgradesLast24h),
            source: "propertySubscriptions with tier=unlimited and updatedAt within 24h"
          },
          {
            label: "Free -> Paid conversion rate",
            value: `${freeToPaidRate.toFixed(1)}%`,
            source: "count(tier=unlimited) / count(all propertySubscriptions)"
          },
          {
            label: "Trial -> Paid conversion rate",
            value: `${trialToPaidRate.toFixed(1)}%`,
            source: "count(tier=unlimited and status=active) / count(status in trial|active)"
          },
          {
            label: "Properties hitting sync limits today",
            value: String(propertiesHitSyncLimitToday),
            source: "syncUsageByProperty where count >= 10 for today",
            critical: propertiesHitSyncLimitToday > 0
          }
        ]
      },
      {
        title: "Usage & Adoption",
        items: [
          {
            label: "Active properties (last 7 days)",
            value: String(activeProperties7d),
            source:
              "properties with activity in paymentSubmissions, careProofSubmissions, refundRequests, tickets, fixRequests, permissionRequests, propertyExpenses"
          },
          {
            label: "Inactive properties (14+ days)",
            value: String(inactiveProperties14d),
            source: "properties with no activity or latest activity older than 14 days",
            critical: inactiveProperties14d > Math.max(3, state.properties.length * 0.4)
          },
          {
            label: "Average properties per landlord",
            value: averagePropertiesPerLandlord.toFixed(2),
            source: "properties count / landlords count"
          },
          {
            label: "Top landlords by properties",
            value: topLandlords || "N/A",
            source: "landlords ranked by number of associated properties"
          }
        ]
      },
      {
        title: "System Health",
        items: [
          {
            label: "Sync success rate",
            value: `${syncSuccessRate.toFixed(1)}%`,
            source: "outbox queue status=synced / total outbox mutations"
          },
          {
            label: "Retry rate",
            value: `${retryRate.toFixed(1)}%`,
            source: "outbox mutations with retries>0 / total outbox mutations"
          },
          {
            label: "Failed sync rate",
            value: `${failedSyncRate.toFixed(1)}%`,
            source: "outbox status in failed|needsReview / total outbox mutations",
            critical: failedSyncRate >= 5
          },
          {
            label: "Properties with unsynced data >48h",
            value: String(propertiesWithUnsynced48h),
            source:
              "distinct propertyId from queued payment/care/refund/ticket records older than 48h",
            critical: propertiesWithUnsynced48h > 0
          },
          {
            label: "Storage usage and estimated cost",
            value: `${storageGB.toFixed(2)} GB (~$${estimatedStorageCostUsd.toFixed(3)}/mo)`,
            source: "estimated attachment volume * 250KB/file; $0.023/GB-month"
          }
        ]
      },
      {
        title: "Support Load",
        items: [
          {
            label: "Open tickets",
            value: String(openTickets),
            source: "tickets with status open|in_progress",
            critical: openTickets > 30
          },
          {
            label: "Average resolution time",
            value: `${averageResolutionHours.toFixed(1)}h`,
            source: "mean(updatedAt - createdAt) for tickets with status resolved|closed"
          },
          {
            label: "Tickets created in last 7 days",
            value: String(recentTickets),
            source: "tickets with createdAt in last 7 days"
          }
        ]
      }
    ]
  };
};

export const getFounderDailySnapshot = (
  state: ColonusState & { syncUsageByProperty: Record<string, { date: string; count: number }> },
  outboxQueue: SyncMutation[]
): FounderMetricsSnapshot => {
  const dayKey = todayKey();
  const stored = readStoredSnapshot();
  if (stored && stored.dayKey === dayKey) {
    return stored.snapshot;
  }
  const snapshot = buildFounderMetricsSnapshot(state, outboxQueue);
  writeStoredSnapshot({ dayKey, snapshot });
  return snapshot;
};
