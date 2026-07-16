# Essential HICS — Hospital Incident Command System SaaS

A multi-tenant SaaS platform for running hospital emergency operations the way **HICS (Hospital Incident Command System)** prescribes: incident activation, HIMT org charts, a data-driven **HICS 2014 forms engine**, IAP building with approval workflow and PDF packets, live status boards (beds / acuity / supplies / staffing / facility systems), resource requests → procurement → cost accounting with FEMA PA tagging, labor pool & credentialed-volunteer management, HICS 213/214 messaging and logging — plus the year-round preparedness program: HVA, EOP library, a **step-by-step EOP Plan Builder** with regulation-mapped starter language (CMS 42 CFR 482.15 + Joint Commission EM) that publishes into the plan library, exercise scheduler with CMS two-per-year tracking, AAR/CAPA, and an element-level **CMS EP Rule + Joint Commission EM compliance library** with evidence binder export.

**Stack:** React 18 + Vite + TypeScript + Tailwind (offline-first PWA) · Supabase (Postgres + RLS, Auth/SSO, Realtime, Storage, Edge Functions) · Stripe billing.

## Import into bolt.new

1. Push this repository to GitHub and import it into bolt.new (or open it directly). No code changes are required.
2. **Connect Supabase** from bolt's integration panel — this sets `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
3. **Apply the database migrations** in `supabase/migrations/` in filename order. They create the full schema, enable RLS with tenant isolation on every table, seed the global catalogs (HIMT positions, Job Action Sheets, Incident Response Guides, the CMS/TJC compliance starter library), and create the private tenant-scoped `documents` storage bucket.
4. Run it: `npm install && npm run dev`.
5. Sign up with email/password, then use the onboarding wizard to **create your organization** (you become Org Admin) — or join an existing one with its invite code (Admin → Organization).

Everything except sending external notifications and Stripe checkout works with steps 1–4 alone.

## Optional integrations (edge functions)

Deploy the functions in `supabase/functions/` and set secrets with `supabase secrets set`:

| Function | Purpose | Secrets |
|---|---|---|
| `send-notification` | Fan out notifications through the vendor-agnostic provider layer (email live via Resend; SMS/paging are pluggable stubs) | `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL` |
| `stripe-checkout` | Subscription checkout per plan | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_STANDARD`, `STRIPE_PRICE_PROFESSIONAL`, `STRIPE_PRICE_ENTERPRISE` |
| `stripe-portal` | Stripe customer portal (invoices, payment methods) | `STRIPE_SECRET_KEY` |
| `stripe-webhook` | Sync subscription state → tenant entitlements | `STRIPE_WEBHOOK_SECRET` |

For SSO, enable **Azure (Entra ID)** and **Google** OAuth providers in Supabase Auth; Okta/SAML uses Supabase's SSO domain flow (`signInWithSSO`). Local email/password accounts work out of the box for responders and volunteers.

## Architecture notes

- **Multi-tenancy & security** — every tenant-scoped table carries `tenant_id`; RLS policies (see migrations) restrict all reads/writes to the caller's organization via the `current_tenant_id()` helper. Onboarding runs through `SECURITY DEFINER` RPCs (`setup_organization`, `join_organization`). The audit log is INSERT-only under RLS — immutable by construction.
- **Offline-first (hard requirement)** — the app is an installable PWA. All reads/writes go through `src/lib/repo.ts`: reads fall back to an IndexedDB cache (Dexie), writes apply locally first and queue in an outbox that syncs on reconnect. Conflicts resolve last-writer-wins and are flagged for review; the header shows online/offline, pending-sync count, and last-synced time. Realtime enhances the status boards when online but nothing depends on it.
- **Forms engine** — the standard HICS 2014 set lives as data in `src/data/hicsForms.ts` (bundled so forms work offline) and is interpreted by `src/components/FormRenderer.tsx`. Tenant-owned templates in the `form_templates` table override bundled ones by code, so org customization is configuration, not code. Form instances are versioned with an append-only history table.
- **No-PHI rule** — the system stores **aggregate counts and status only**. Patient-related forms (HICS 254/255/259/260) and the patient-tracking module are count/status mode by design (no identifier fields exist), with save-time validation (`src/lib/noPhi.ts`) that blocks identifier-shaped content in free text.
- **Notifications** — vendor-agnostic `NotificationProvider` interface (`supabase/functions/_shared/notification-providers.ts`). Email ships working; add a Twilio/Everbridge-class adapter and register it in `getProvider()` — no other code changes.
- **Permissions** — data-driven matrix (`permission_settings` + defaults in `src/lib/permissions.ts`): who can declare incidents, approve IAPs/requests, send mass notifications, and the Finance sign-off cost threshold. RLS remains the server-side enforcement layer.
- **Exports** — all PDF generation (forms, IAP packet, SitRep, HVA, cost reports, compliance binder) is client-side via jsPDF, so it works offline at the command post. Tabular exports also ship as CSV.

## Scripts

```bash
npm run dev        # dev server
npm run build      # typecheck + production build (PWA)
npm run typecheck  # tsc only
```

## Repository layout

```
supabase/migrations/   schema + RLS + seeded catalogs (apply in order)
supabase/functions/    edge functions (notifications, Stripe)
src/lib/               supabase client, offline repo/sync, PDF, permissions, no-PHI guard
src/data/              HICS 2014 form templates, HIMT position catalog
src/components/        UI kit, forms engine renderer, app shell
src/pages/             auth/onboarding, dashboard, incident workspace, preparedness, admin, reports
```

> HICS form field definitions are a working representation of the HICS 2014 set; verify against the current ASPR TRACIE / California EMSA releases before survey-critical use. The compliance library ships as a versioned starter (`2024.1-starter`) — review against currently published CMS/TJC language.
