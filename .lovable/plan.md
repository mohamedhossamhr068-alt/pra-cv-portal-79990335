
# PRA Career Portal — Enterprise AI Workforce Platform

A multi-tenant SaaS on TanStack Start + Lovable Cloud (Supabase) + Lovable AI Gateway, with Stripe billing, bilingual EN/AR (RTL), and an enterprise dashboard UI.

Given the scope, v1 ships every module end-to-end but each starts focused. We can deepen any module on follow-up turns.

---

## 1. Stack & Foundations

- **Frontend:** TanStack Start (React 19, Vite 7), Tailwind v4, shadcn/ui
- **Backend:** TanStack `createServerFn` + server routes (`/api/public/*` for webhooks)
- **DB / Auth / Storage:** Lovable Cloud (Supabase, RLS-enforced multi-tenancy)
- **AI:** Lovable AI Gateway, `google/gemini-3-flash-preview`
- **Payments:** Stripe (Lovable built-in, `enable_stripe_payments`)
- **i18n:** `i18next` + `react-i18next`, EN/AR with full RTL (`dir="rtl"` on `<html>`)
- **PDF:** `@react-pdf/renderer` (server-rendered via server fn → returned as base64/blob)

---

## 2. Database Schema (Supabase migrations)

Tables (all in `public`, RLS on, GRANTs per Lovable rules):

- `tenants` — id, name, slug, industry, branding (logo_url, primary_color), created_at
- `profiles` — id (= auth.users.id), tenant_id, email, full_name, locale, created_at
- `app_role` enum: `superadmin | company_admin | user`
- `user_roles` — id, user_id, tenant_id, role (security-definer `has_role()` function)
- `subscriptions` — id, tenant_id, stripe_customer_id, stripe_subscription_id, plan (`free|pro|business`), status, current_period_end
- `usage_quotas` — id, user_id, tenant_id, month, cv_generations_used
- `cv_logs` — id, tenant_id, user_id, input (jsonb), output (jsonb), template, pdf_storage_path, created_at
- `job_listings` — id, title, company, industry, skills (text[]), seniority, location, external_url, source, created_at
- `job_matches` — id, user_id, job_id, score, reasoning, created_at
- `usage_events` — id, user_id, tenant_id, action_type, metadata (jsonb), created_at
- `audit_logs` — id, actor_id, tenant_id, action, target, metadata, created_at

**RLS pattern:** every tenant-scoped table requires `tenant_id = current_user's tenant` via `has_role()` and a `get_user_tenant(auth.uid())` security-definer fn. Superadmin bypasses via `has_role(auth.uid(),'superadmin')`.

**Trigger:** on `auth.users` insert → create `profiles` row + default `user` role. First user of a new tenant becomes `company_admin`. A seed `superadmin` is granted via SQL after first signup (instructions surfaced to user).

**Storage buckets:**
- `cv-pdfs` (private) — generated PDFs
- `tenant-branding` (public) — company logos

---

## 3. Authentication

- Email/password via Lovable Cloud (auto-confirm on for dev).
- Google OAuth via `lovable.auth.signInWithOAuth("google", …)` + `supabase--configure_social_auth`.
- Signup flow asks for company name → creates tenant + assigns `company_admin`. Invite flow (admin → email) adds users to existing tenant.
- Integration-managed `_authenticated/route.tsx` gate.
- Nested `_authenticated/_admin` gate via `has_role` for company admin pages; `_superadmin` for platform owner.

---

## 4. Routes (file-based)

```
src/routes/
  __root.tsx                       # shell, i18n provider, theme, dir switcher
  index.tsx                        # marketing landing (EN/AR, pricing, CTA)
  pricing.tsx
  auth.tsx                         # sign in / sign up / google
  reset-password.tsx
  _authenticated/
    route.tsx                      # managed gate
    dashboard.tsx                  # KPI overview
    cv.index.tsx                   # CV library
    cv.new.tsx                     # CV generator wizard
    cv.$id.tsx                     # CV viewer + PDF download + template switch
    jobs.tsx                       # job matches
    billing.tsx                    # plan + Stripe portal
    settings.tsx                   # profile, language, theme
    _admin/
      route.tsx                    # company_admin gate
      admin.team.tsx               # invite/manage employees, quotas
      admin.usage.tsx              # tenant usage analytics
      admin.branding.tsx           # logo, colors
    _superadmin/
      route.tsx                    # superadmin gate
      platform.tenants.tsx         # all companies
      platform.analytics.tsx       # platform-wide
      platform.billing.tsx         # subscription health
  api/
    public/
      webhooks.stripe.ts           # signed webhook handler
```

---

## 5. Server Functions (`src/lib/*.functions.ts`)

- `cv.functions.ts`
  - `generateCv({input, template})` — middleware `requireSupabaseAuth`; checks quota; calls Lovable AI Gateway (structured output via `Output.object` + zod schema for the 6 sections); persists `cv_logs`; increments `usage_quotas`; logs `usage_events`.
  - `renderCvPdf({cvId})` — fetches cv, renders with `@react-pdf/renderer` server-side, uploads to `cv-pdfs`, returns signed URL.
  - `listCvs`, `getCv`, `deleteCv`.
- `jobs.functions.ts`
  - `matchJobs({userId})` — pulls user CV skills, AI-scores against `job_listings`, returns ranked matches (stored to `job_matches`).
  - `listJobs({filters})`.
- `tenant.functions.ts` — invite user (admin API via `supabaseAdmin`, gated by `has_role admin`), update branding, set member quota override.
- `billing.functions.ts` — create checkout session (via Stripe payments tool), open customer portal, current subscription.
- `analytics.functions.ts` — KPIs for dashboard/admin/superadmin.
- `platform.functions.ts` — superadmin: list tenants, suspend, view aggregate usage.

AI rule enforcement: system prompt forbids fabrication; structured schema only allows rewriting/expanding user-provided inputs. Quotas enforced server-side before AI call.

---

## 6. AI CV Generator

- Multi-step wizard (name → role → experience entries → skills → industry → seniority → template choice).
- Structured output schema: `{summary, competencies[], experience[{role,company,dates,bullets[]}], achievements[], skillsMatrix[{category,skills[]}], recommendations[]}`.
- Three PDF templates as React-PDF components: **Modern Executive**, **Corporate Minimal**, **Creative Professional**, each respecting tenant branding (logo + primary color toggleable).
- ATS-friendly: single column option, standard fonts (Inter / Noto Sans Arabic).

---

## 7. Stripe Billing

- Run `recommend_payment_provider` → `enable_stripe_payments`.
- Products via `batch_create_product`: Free (3/mo, $0), Pro (50/mo, $29), Business (unlimited + team, $99).
- Checkout from `billing.tsx`; webhook at `/api/public/webhooks/stripe` verifies signature, upserts `subscriptions`, resets quotas on renewal, downgrades to Free on `payment_failed`.

---

## 8. Internationalization (EN / AR + RTL)

- `i18next` with `en.json`, `ar.json` covering all UI strings.
- Root layout sets `<html lang dir>` based on selected locale; Tailwind v4 logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`) throughout.
- Locale persisted on `profiles.locale` and in localStorage.
- Arabic font: `@fontsource/noto-sans-arabic`; English: `@fontsource/inter`.

---

## 9. Design System

Enterprise SaaS aesthetic (Notion/Linear/Workday hybrid):
- Dark + light themes via CSS tokens in `src/styles.css` (oklch).
- Sidebar shell with collapsible nav, breadcrumb header, command palette (cmdk).
- Tokens: `--primary` deep indigo, `--accent` teal, neutral grays, gradient/shadow tokens for hero/landing.
- All shadcn components themed via tokens; no hardcoded colors.

---

## 10. Analytics

- Admin dashboard tiles: CVs this month, active users, quota usage, top skills.
- Superadmin: tenants count, MRR (from `subscriptions`), AI requests/day, top tenants by usage.
- Charts via `recharts`.

---

## 11. Security

- RLS on every table, `has_role` security-definer fn, tenant isolation via `get_user_tenant()`.
- Server functions validate inputs with zod.
- Quotas enforced server-side; AI calls only after quota check + decrement in transaction.
- Stripe webhook signature verified (HMAC, timing-safe).
- `supabaseAdmin` only imported dynamically inside privileged handlers after role check.
- Audit log on admin/superadmin mutations.

---

## 12. Build Order (single pass)

1. Enable Lovable Cloud, provision LOVABLE_API_KEY.
2. Migrations: enums, tables, RLS, grants, triggers, security-definer fns, storage buckets.
3. Auth scaffolding (signup with tenant creation, Google OAuth, password reset).
4. App shell: sidebar, header, theme + i18n + RTL toggle, design tokens.
5. CV generator (server fn + wizard UI + structured AI output).
6. PDF templates (3) + server-side render + storage upload.
7. CV library + viewer.
8. Quota + usage tracking.
9. Stripe: enable, create products, checkout, webhook, billing page.
10. Job listings (seed data) + AI matching + jobs page.
11. Company admin: team, branding, usage.
12. Superadmin: tenants, platform analytics.
13. Marketing landing + pricing (bilingual).
14. Smoke test critical flows via Playwright.

---

## Technical Notes

- Use `requireSupabaseAuth` middleware on all `_authenticated` server fns; `attachSupabaseAuth` is already wired by integration.
- Public route loaders (landing/pricing) must NOT call protected fns.
- `supabaseAdmin` loaded via `await import('@/integrations/supabase/client.server')` inside handlers only, after role check.
- AI Gateway: per-request provider via `createLovableAiGatewayProvider(process.env.LOVABLE_API_KEY)`; structured output via `Output.object({schema})`; do not retry 400s.
- PDF render runs server-side (Workers-compatible build of `@react-pdf/renderer`); if any native dep issue arises, fall back to client-side render + upload via signed URL.

## Out of scope for v1 (flag for follow-up)

- Real LinkedIn/Indeed job API integrations (we ship the matching engine + seed jobs + adapter interface; real keys later).
- SSO/SAML for enterprise tenants.
- Email notifications (can add via Lovable Email later).
- Mobile native apps.

Approve and I'll execute the full build pass.
