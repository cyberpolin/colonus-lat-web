"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { GradeBadge } from "@/components/ui/grade-badge";
import { GradeCard } from "@/components/ui/grade-card";
import { GradeEditForm } from "@/components/ui/grade-edit-form";
import { InfoCard } from "@/components/ui/info-card";
import { Input } from "@/components/ui/input";
import { Main } from "@/components/ui/main";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { UiSystemThemeSelector } from "@/components/ui-system-theme-selector";
import type { TenantGrade } from "@colonus/shared";

const slateSwatches = [
  "slate-50",
  "slate-100",
  "slate-200",
  "slate-300",
  "slate-400",
  "slate-500",
  "slate-600",
  "slate-700",
  "slate-800",
  "slate-900",
  "slate-950"
] as const;

const swatchClass: Record<(typeof slateSwatches)[number], string> = {
  "slate-50": "bg-slate-50",
  "slate-100": "bg-slate-100",
  "slate-200": "bg-slate-200",
  "slate-300": "bg-slate-300",
  "slate-400": "bg-slate-400",
  "slate-500": "bg-slate-500",
  "slate-600": "bg-slate-600",
  "slate-700": "bg-slate-700",
  "slate-800": "bg-slate-800",
  "slate-900": "bg-slate-900",
  "slate-950": "bg-slate-950"
};

export default function UiSystemPage() {
  const gradeExample: TenantGrade = {
    id: "tenant_grade_example",
    propertyId: "property_example_1",
    tenantId: "tenant_example_1",
    score: 4.2,
    reasons: ["On-time payments", "Communication"],
    note: "Consistent responses and payment confirmations.",
    createdByUserId: "landlord_example_1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 3
  };

  return (
    <Main
      eyebrow="COLONUS"
      title="UI System"
      description="Deterministic component catalog aligned to AGENTS.md."
      className="space-y-6"
    >
      <nav id="ui-system-breadcrumb" aria-label="Breadcrumb" className="text-xs text-slate-500">
        <p className="flex flex-wrap items-center gap-2">
          <Link href="/" className="hover:text-slate-700">
            Home
          </Link>
          <span>/</span>
          <span className="text-slate-700">UI System</span>
        </p>
      </nav>

      <UiSystemThemeSelector />

      <Card title="1) Typography Samples">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-slate-900">Page Title / text-2xl</h2>
          <h3 className="text-lg font-semibold text-slate-900">Section Title / text-lg</h3>
          <p className="text-base text-slate-700">Body text / text-base for default reading content.</p>
          <p className="text-sm text-slate-600">Body compact / text-sm for dense cards and forms.</p>
          <p className="text-xs text-slate-500">Caption / text-xs for metadata and helper labels.</p>
        </div>
      </Card>

      <Card title="2) Slate Color Swatches">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
          {slateSwatches.map((swatch) => (
            <div key={swatch} className="rounded-lg border border-slate-200 p-2">
              <div className={`h-10 rounded ${swatchClass[swatch]}`} />
              <p className="mt-2 text-xs text-slate-600">{swatch}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="3) PageHeader (Reusable Surface Header)">
        <div className="space-y-4">
          <PageHeader
            eyebrow="Super Admin"
            title="Landlord Clients"
            description="Search, filter, and manage clients from a full-width slate banner."
            actions={<Button variant="secondary" size="sm">Header Action</Button>}
          />
          <p className="text-sm text-slate-600">
            Use `PageHeader` for top-level route headers. It is a dedicated full-width banner, independent from `Card`.
          </p>
        </div>
      </Card>

      <Card title="3.1) Main (Screen Shell)">
        <div className="space-y-2 text-sm text-slate-700">
          <p>
            `Main` is the shared route shell component.
          </p>
          <p>
            It enforces `min-h-screen`, standard page paddings, and renders `PageHeader` as the first child.
          </p>
          <p>
            Use props: `eyebrow`, `title`, `description`, `maxWidthClassName`, `className`, `headerClassName`.
          </p>
        </div>
      </Card>

      <Card title="4) Buttons (Variants, Sizes, States)">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm">Primary sm</Button>
            <Button variant="primary" size="md">Primary md</Button>
            <Button variant="primary" size="lg">Primary lg</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
          </div>
        </div>
      </Card>

      <Card title="5) Inputs (Text, Number, Password, Textarea, Error)">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 md:col-span-2">
            Input rule: use reusable `Input`, `Select`, and `Textarea` components across app forms.
          </div>
          <div className="space-y-2">
            <label className="text-xs text-slate-600">Text</label>
            <Input placeholder="Full name" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-slate-600">Number</label>
            <Input type="number" placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-slate-600">Password</label>
            <Input type="password" placeholder="••••••••" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-slate-600">Select</label>
            <Select defaultValue="1">
              <option value="1">1 month cycle</option>
              <option value="3">3 month cycle</option>
              <option value="6">6 month cycle</option>
              <option value="12">12 month cycle</option>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs text-slate-600">Textarea</label>
            <Textarea placeholder="Notes" rows={4} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs text-slate-600">Error State</label>
            <Input hasError placeholder="This field has an error" />
            <p className="text-xs text-slate-600">Validation message example.</p>
          </div>
        </div>
      </Card>

      <Card title="6) Cards (Eyebrow, Clickable, Collapsible, Footer)">
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <p className="font-medium text-slate-900">Card is the base surface primitive.</p>
            <p className="mt-1">
              Use it for reusable container styling (radius, border, spacing, shadow). Supports `eyebrow`, `title`,
              `footer`, `clickable`, `collapsible`, and `defaultCollapsed`.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card eyebrow="Surface" title="Default Card">
              <p className="text-sm text-slate-600">Simple read-only container.</p>
            </Card>
            <Card title="Clickable Card" clickable>
              <p className="text-sm text-slate-600">Hover style for selectable blocks.</p>
            </Card>
            <Card
              title="Card With Footer"
              footer={
                <div className="flex items-center justify-between">
                  <Badge variant="muted">Pending</Badge>
                  <Button variant="secondary" size="sm">Open</Button>
                </div>
              }
            >
              <p className="text-sm text-slate-600">Header/body/footer structure.</p>
            </Card>
            <Card eyebrow="Advanced" title="Collapsible Card" collapsible>
              <p className="text-sm text-slate-600">Collapse/expand section content without leaving the page.</p>
            </Card>
            <Card title="Collapsed By Default" collapsible defaultCollapsed>
              <p className="text-sm text-slate-600">This starts collapsed and can be opened by the user.</p>
            </Card>
          </div>
        </div>
      </Card>

      <Card title="7) InfoCard (Compact Status Card)">
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Use `InfoCard` for compact status summaries that are visually lighter than full feature cards.
          </p>
          <InfoCard
            badge={
              <p className="inline-flex rounded-full border border-slate-300 px-2 py-1 text-xs text-slate-600">
                Free Trial
              </p>
            }
            description="Sync usage today: 4/10"
          />
        </div>
      </Card>

      <Card title="8) Lists / Rows (Tenant & Landlord)">
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Nora Wells</p>
              <p className="text-xs text-slate-500">Tenant • Slate Heights A-12</p>
            </div>
            <Badge>Active</Badge>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Marina Lowell</p>
              <p className="text-xs text-slate-500">Landlord • 2 properties</p>
            </div>
            <Badge variant="strong">Owner</Badge>
          </div>
        </div>
      </Card>

      <Card title="9) EmptyState + Loading / Skeleton">
        <div className="grid gap-4 md:grid-cols-2">
          <EmptyState
            title="No Payments Yet"
            message="When a tenant submits a payment, it will appear here."
            actionLabel="Create Sample"
          />
          <div className="space-y-2 rounded-xl border border-slate-200 p-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      </Card>

      <Card title="10) Tenant Grade">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">GradeBadge Variants</p>
            <div className="flex flex-wrap gap-2">
              <GradeBadge score={4.8} />
              <GradeBadge score={3.9} />
              <GradeBadge score={2.8} />
              <GradeBadge score={1.9} />
              <GradeBadge />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">GradeCard Example</p>
            <GradeCard grade={gradeExample} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded border border-slate-200 p-3">
              <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">Edit Form (Default)</p>
              <GradeEditForm
                value={{ score: 4, reasons: ["On-time payments"], note: "" }}
                onChange={() => {}}
                onSubmit={() => {}}
              />
            </div>
            <div className="rounded border border-slate-200 p-3">
              <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">Edit Form (Disabled)</p>
              <GradeEditForm
                value={{ score: 3, reasons: ["Other"], note: "Read-only state" }}
                onChange={() => {}}
                onSubmit={() => {}}
                disabled
              />
            </div>
            <div className="rounded border border-slate-200 p-3">
              <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">Edit Form (Loading / Error)</p>
              <GradeEditForm
                value={{ score: 6, reasons: [], note: "" }}
                onChange={() => {}}
                onSubmit={() => {}}
                loading
                error="Score must be between 1 and 5."
              />
            </div>
          </div>
        </div>
      </Card>

      <Card title="11) SuperAdmin Founder Dashboard Patterns">
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <p>Executive summary layout for founder metrics (daily snapshot).</p>
            <p className="mt-1">Pattern: quick KPI strip, critical states, sectioned metric cards with calculation source.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <article className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Monthly Recurring Revenue (MRR)</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">$2,430.00</p>
            </article>
            <article className="rounded-lg border border-slate-500 bg-slate-100 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">At-risk revenue</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">$130.00</p>
            </article>
            <article className="rounded-lg border border-slate-500 bg-slate-100 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Failed sync rate</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">6.2%</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Open tickets</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">27</p>
            </article>
          </div>

          <div className="rounded-lg border border-slate-300 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">Critical States</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-700">
              <p className="rounded-full border border-slate-400 bg-slate-100 px-2 py-1">3 properties are past due.</p>
              <p className="rounded-full border border-slate-400 bg-slate-100 px-2 py-1">Failed sync rate is 6.2%.</p>
              <p className="rounded-full border border-slate-400 bg-slate-100 px-2 py-1">2 properties have unsynced data older than 48h.</p>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">
              System Health
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              <article className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Sync success rate</p>
                </div>
                <p className="mt-1 text-xl font-semibold text-slate-900">91.8%</p>
                <p className="mt-2 text-[11px] text-slate-600">
                  Calculation source: outbox queue status=synced / total outbox mutations
                </p>
              </article>
              <article className="rounded-lg border border-slate-500 bg-slate-100 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Properties with unsynced data &gt;48h</p>
                  <span className="rounded-full border border-slate-500 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-700">
                    Attention
                  </span>
                </div>
                <p className="mt-1 text-xl font-semibold text-slate-900">2</p>
                <p className="mt-2 text-[11px] text-slate-600">
                  Calculation source: distinct propertyId from queued records older than 48h
                </p>
              </article>
            </div>
          </div>
        </div>
      </Card>

      <Card title="12) Empty/Loading Adoption Map">
        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
            Super Admin Clients: empty filters + unselected detail pane with skeleton.
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
            Super Admin Client Details: empty properties/tenants/periods/payments.
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
            Landlord Tenant Portfolio: empty filter state + unselected detail pane with skeleton.
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
            Landlord Property Portfolio: empty filter state + unselected detail pane with skeleton.
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
            Landlord Management + Add Client Wizard: empty draft/settings states.
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
            Main Dashboard: empty proofs, tickets, documents, and property placeholders.
          </div>
        </div>
      </Card>

      <Card title="13) MainMenu (Role Based)">
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            Reusable fixed top bar with role-specific menus (`super_admin`, `landlord`, `tenant`) driven by
            `main-menu.by-role.json`.
          </p>
          <div className="rounded border border-slate-200 p-3 text-xs text-slate-600">
            Preview is disabled inside UI System to avoid route-level fixed overlap. Component contract:
            `visible`, `role`, `hasClientDraft`, `freeTrialUsage`, `onSeedFake`, `onClearDatabase`.
          </div>
        </div>
      </Card>

      <Card title="14) First-Time Onboarding Pattern">
        <div className="space-y-2 text-sm text-slate-700">
          <p>
            Route-driven onboarding flow pattern is supported for landlord first login with:
            `/landlord?firstTime=1`.
          </p>
          <p>
            Structure: step indicator + guided forms + summary checkpoint.
          </p>
          <p>
            Typical sequence: create property, configure rent cycle, add tenants, review summary.
          </p>
        </div>
      </Card>

      <Card title="15) Auth Flow Pattern">
        <div className="space-y-2 text-sm text-slate-700">
          <p>
            Login route: `/login` with role autodetection by email (super admin, landlord, tenant).
          </p>
          <p>
            Demo password: `demo123`.
          </p>
          <p>
            Logout route: `/goodbye` (clears auth session).
          </p>
          <p>
            Route guards require authenticated session; landlord and tenant are scoped to their own records.
          </p>
        </div>
      </Card>

      <Card title="16) Website + Upgrade Funnel">
        <div className="space-y-2 text-sm text-slate-700">
          <p>Commercial website route: `/website` with product value, tiers, and CTA to upgrade.</p>
          <p>Dummy upgrade wizard route: `/website/upgrade` with steps (plan, account, billing, confirm).</p>
          <p>
            Main menu free-trial gauge supports hover CTA (`Upgrade`) that links directly to `/website/upgrade`.
          </p>
        </div>
      </Card>

      <Card title="17) Card IDs">
        <div className="space-y-2 text-sm text-slate-700">
          <p>All reusable `Card` surfaces now receive descriptive IDs automatically.</p>
          <p>Pattern: `card-title-slug-unique` with optional explicit `id` override.</p>
          <p>Route-level custom card sections also include explicit IDs for QA, automation, and support references.</p>
        </div>
      </Card>

      <Card title="18) Color Theme System">
        <div className="space-y-2 text-sm text-slate-700">
          <p>Centralized color management is handled by a global app theme shell.</p>
          <p>Theme picker is visual: fixed Slate base + randomized color swatches on each load.</p>
          <p>
            UI System selector (`#ui-system-theme-select`) updates persisted theme hue/color in Zustand and applies
            the full app color transform.
          </p>
        </div>
      </Card>

      <Card title="19) Public Property Listings">
        <div className="space-y-3 text-sm text-slate-700">
          <p>Public routes use slug-based detail pages: `/available-units/[listingSlug]`.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <article className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Listing Card</p>
              <p className="mt-1 font-medium text-slate-900">Depa Centro - Bright Unit</p>
              <p className="text-xs text-slate-600">2 beds · 1 bath · 72 sqm</p>
              <p className="mt-2 text-sm text-slate-700">$1,200.00 / month</p>
              <p className="mt-2 text-xs text-slate-600">Used in: `/available-units` grid</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Detail + Inquiry</p>
              <p className="mt-1 font-medium text-slate-900">Public detail + rent request form</p>
              <p className="mt-2 text-xs text-slate-600">
                Form fields: name, email, phone (optional), message (optional).
              </p>
              <p className="mt-2 text-xs text-slate-600">
                Submit action: `POST /api/public/listings/:listingSlug/request-rent`
              </p>
            </article>
          </div>
        </div>
      </Card>
    </Main>
  );
}
