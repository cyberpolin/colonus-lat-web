# COLONUS — AGENTS.md
AI agent instructions for this repository.

## Project summary
COLONUS is a NEW product for tenants and landlords.

Stack:
- Backend: Keystone.js (Node/TypeScript)
- Frontend: Next.js (React) (monochrome UI)
- State: Zustand
- Storage strategy: **local-first**
  - Always write to local storage first
  - Then sync to backend via a dedicated sync layer

## Repo structure (target)
- /apps/web              # Next.js app (UI + local-first state)
- /apps/api              # Keystone backend
- /packages/shared       # Shared types, validators, utilities
- /packages/sync         # Sync engine (queue, retries, conflict handling)

If structure differs, follow the existing repo layout, but keep these boundaries.

---

## Global coding rules
- TypeScript everywhere.
- Prefer small modules and explicit exports.
- Avoid `any`. Use `unknown` + narrowing if needed.
- Prefer pure functions and deterministic logic.
- No heavy abstractions unless it reduces complexity.
- Add comments only when the reason is not obvious.

## Git + change discipline
- Keep diffs small and reviewable.
- Don’t “reformat the world”.
- If changing behavior, add tests or a minimal validation script.
- Update docs when changing conventions.

---

## Frontend (Next.js + Zustand + local-first)
### UI rules
- Use Tailwind CSS.
- Monochrome theme using **slate** tones (slate-*).
- Minimal, clean components.
- Avoid custom colors unless explicitly requested.
- Prefer composition over huge components.

### State & storage rules
- Zustand is the source of truth for UI state.
- Persist state in local storage.
- **Local-first invariant**:
  1) UI action updates Zustand immediately
  2) Persist to local storage immediately
  3) Enqueue an outbox sync job
  4) Sync layer sends to backend asynchronously
  5) Backend responses reconcile state

### Architecture guidance (frontend)
- Keep UI components dumb; put logic in hooks/services.
- Do not call backend directly from components.
- All network writes must go through `/packages/sync` (or equivalent).
- Reads:
  - Prefer reading from local state/storage first.
  - Allow background refresh to update cache.

### Storage naming & versioning
- Local storage keys should be prefixed with `COLONUS_`.
- Use a `STORAGE_VERSION` and migrations if schema changes.

---

## Sync layer (required)
Goal: reliable offline-first writes.

### Core concepts
- Outbox queue (append-only preferred).
- Job types: create/update/delete per entity.
- Retry with exponential backoff.
- Idempotency:
  - Every mutation should have a stable `mutationId`.
- Conflict policy (default):
  - Prefer **last-write-wins** with timestamps unless specified otherwise.
  - If conflict is detected and cannot be auto-resolved, mark as `needsReview`.

### MUSTs
- Never block UI on sync completion.
- Never drop queued mutations silently.
- Keep all mutations serializable and replayable.
- Sync must be safe if re-run multiple times.

---

## Backend (Keystone.js)
### Keystone rules
- Keep schema modular (lists per domain area).
- Use access control and validation from the start (even if simple).
- Prefer explicit fields + indexes.
- Add minimal seed/dev data only if it helps development.

### Data model conventions
- Use `id` as primary identifier.
- Add `createdAt`, `updatedAt` (server authoritative).
- For client-generated objects, support `clientId` or `externalId` if needed.

### API conventions
- Provide stable CRUD for entities used by sync.
- Support idempotent writes where possible (e.g., mutationId).
- Validate inputs and return clear error messages.

---

## Testing & quality checks
- Frontend: at least unit tests for sync queue logic (happy path + retry).
- Backend: minimal tests for access control + key mutations.
- Add lightweight scripts:
  - lint
  - typecheck
  - test (where applicable)

If time is limited, prioritize:
1) typecheck
2) tests for sync queue
3) basic integration sanity check

---

## Security & privacy
- Do not store secrets in local storage.
- Do not log sensitive tenant/landlord data.
- Default to least-privilege access control in Keystone.

---

## When you (the agent) are unsure
- Prefer the simplest approach that preserves:
  - local-first behavior
  - sync reliability
  - modularity between UI / state / sync / backend
- Make a note in the PR/summary about assumptions made.

---

## Design system baseline (Refactoring-UI-inspired)
Goal: consistent, clean UI that reads well, with strong hierarchy and spacing.
Use practical visual design heuristics (clear hierarchy, whitespace, typography, contrast, grouping, and states).
Do NOT copy any proprietary Refactoring UI content verbatim.

### Visual style
- Default palette: Tailwind **slate** monochrome only.
- Start with:
  - Backgrounds: slate-950 / slate-900 / slate-800 (or light mode slate-50 / slate-100)
  - Text: slate-50 / slate-200 / slate-400 (or light mode slate-900 / slate-700)
  - Borders: slate-800 / slate-700 (or light mode slate-200 / slate-300)
- No accent colors unless explicitly requested.
- Prefer subtle depth: borders + slight shadow over strong gradients.

### Typography & hierarchy
- Use consistent type scale:
  - Page title: text-xl or text-2xl, font-semibold
  - Section title: text-lg, font-semibold
  - Body: text-sm or text-base
  - Secondary: text-xs or text-sm with slate-400/s-500
- Prefer shorter line lengths and clear labels.
- Use weight + spacing to create hierarchy before adding color.

### Spacing & layout rules
- Use an 8px spacing rhythm (Tailwind: 2, 4, 6, 8, 10, 12…).
- Cards/containers:
  - Padding: p-4 (mobile) / p-6 (desktop)
  - Radius: rounded-xl (or rounded-lg for denser UIs)
  - Border: border border-slate-800 (or light: border-slate-200)
- Forms:
  - Label above input
  - Consistent gaps (gap-2 label->input, gap-4 between fields)
- Avoid dense tables; prefer grouped lists + rows with clear alignment.

### Components & states (mandatory)
Every interactive component must include:
- default, hover (web), pressed (mobile), focus-visible (web), disabled, loading, error.
- consistent hit target (>= 44px height where applicable).

### UI primitives (preferred)
Use these primitives instead of ad-hoc markup:
- Button (variants: primary/secondary/ghost/destructive; sizes: sm/md/lg)
- Input / TextArea
- Select
- Card
- Badge
- Modal / Sheet (if needed)
- Toast/Notification (optional)
- EmptyState
- Skeleton (optional)

---

## uiSystem screen (mandatory)
We maintain a living catalog of current UI components.

### Purpose
A single screen/page to preview and validate the UI system:
- shows all components + variants + states
- acts as visual regression reference
- updated whenever new UI components are added or changed

### Location (choose based on platform)
- Web (Next.js): /apps/web/src/app/ui-system/page.tsx (or /pages/ui-system.tsx)
- Mobile (if any): /apps/mobile/src/screens/UiSystem.tsx

### Rules
- Every PR that adds/changes UI components MUST update uiSystem.
- uiSystem must render components with:
  - slate monochrome theme
  - spacing rhythm and typography scale
  - examples of states (disabled/loading/error)
- Keep uiSystem deterministic and fast (no real network calls).
- If a component requires data, provide mock data inline.

### Required sections
1) Typography samples (titles, body, captions)
2) Colors (slate scale swatches used)
3) Buttons (all variants + sizes + states)
4) Inputs (text, number, password, textarea) + error state
5) Cards (default, clickable, with header/body/footer)
6) Lists/Rows (for tenant/landlord entities)
7) EmptyState + Loading/Skeleton


---

## Billing, Subscriptions & Property-Based Tiers

### Core principle
Tiers and payments are attached to **properties**, not to users.

- A landlord pays per property.
- Each property has exactly one active tier.
- All members (landlord, tenants, managers) inherit the property's tier.
- Users may belong to multiple properties with different tiers.

Never implement per-user plans.

---

### Tier inheritance
At runtime, behavior is determined by:

user → membership → property → tier

Examples:
- A tenant may have unlimited at home and free at office.
- A landlord may own multiple properties with different tiers.
- Sync limits and features always depend on the current property context.

---

### Property subscription model
Each property may have:
- tier: free | unlimited
- subscriptionStatus: active | trial | past_due | canceled
- billingProviderId (e.g., Stripe subscription id)
- trialEndsAt (optional)

Each property is treated as an indep

---

### Update the project

After every update, please take a look into seeder, and update it if necesary
