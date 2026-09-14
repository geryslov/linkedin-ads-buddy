# Pull Google Ads spend into the budget tracker

Today Google spend is typed in by hand each month. This connects your Google Ads manager account (MCC) so each client's Google spend fills itself in, the same way LinkedIn spend already does.

## How it will work

1. You sign in once with the Google account that manages the MCC. That connection is shared by the whole team — nobody else has to sign in.
2. In the budget tracker, each client gets a "Google Ads account" picker listing every account under the MCC. You choose the right one per client, once.
3. From then on, month-to-date Google spend appears automatically in that client's Google lane, both in the single-client view and the all-clients pacing table.
4. You keep setting the Google budget yourself. Only spend is pulled.
5. Spend refreshes every time the tracker opens, so the numbers are always current. While it loads, the Google lane shows a small loading state and falls back to the last known value.

If a client has no Google account linked yet, the Google spend field stays manually editable exactly as it is now — nothing breaks for clients you haven't mapped.

## What you need to do

- Approve a one-time Google sign-in when prompted.
- Pick the matching Google Ads account for each client (one dropdown per client).

## Technical details

- Link the `google_ads` connector to the project (`standard_connectors--connect`), giving the backend `LOVABLE_API_KEY` + `GOOGLE_ADS_API_KEY` for gateway calls to `https://connector-gateway.lovable.dev/google_ads/...`.
- New table `public.account_google_links`: `user_id`, `account_id` (LinkedIn ad account), `google_customer_id`, `google_customer_name`, unique on (`user_id`, `account_id`). RLS owner-scoped via `auth.uid()`, plus explicit GRANTs to `authenticated` and `service_role`.
- New edge actions in `supabase/functions/linkedin-api/index.ts`:
  - `list_google_ads_accounts` — `customers/{mcc}:listAccessibleCustomers` then `googleAds:searchStream` on the MCC for `customer_client` rows (id, descriptive_name, currency), excluding managers.
  - `save_google_ads_link` / `delete_google_ads_link` — upsert or clear the mapping for one LinkedIn account.
  - `get_google_spend` — takes a list of `google_customer_id`s and a month; runs a GAQL `searchStream` query over `customer` with `metrics.cost_micros` for `segments.date` within the month, returns `{ customerId: spend }` (cost_micros / 1e6). Batched in one pass for the all-clients view.
- `get_budget_pacing` and `get_budget_pacing_summary` join the link table and, when a link exists, use fetched Google spend in place of the stored `google_spend`; the stored column stays the fallback for unlinked accounts.
- Frontend: `useMegaBudgetPacing.ts` / `useBudgetPacing.ts` surface `googleLinked` and `googleSpendSource`; `MegaBudgetPacingDashboard.tsx` and `BudgetPacingDashboard.tsx` render the account picker and make the Google spend cell read-only when linked.
- MCC customer ID stored as a project secret (`GOOGLE_ADS_MCC_ID`) if not derivable from `listAccessibleCustomers`; all gateway calls send `login-customer-id`.
- Type-check with `npx tsgo -p tsconfig.app.json --noEmit`; deploy `linkedin-api` manually; update `FEATURES.md` and `HISTORY.md`.
