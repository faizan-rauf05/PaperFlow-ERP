# PaperFlow ERP — Project Status

> **For new chats:** Start with "Continue from `docs/PROJECT_STATUS.md`."

Last updated: 2026-09-30

---

## Done so far

### Ink, bag weight, averaged paper cost, per-kg paper price (2026-09-30)
- **Ink cost** is a fixed rate: full paper area (calculated height × calculated width) × 0.000739 **fils**/cm² (`INK_KWD_PER_CM2`), charged once whatever the color count, only on printed lines. Ink is still matched to stock and picked by the warehouse. The pick quantity uses `INK_G_PER_CM2` (0.00008 g/cm², a placeholder until the client confirms real usage).
- **Paper cost** is the average of two methods: by length (meters × cost/m), and by weight (meters × roll width × GSM × cost/kg, where cost/kg = roll cost ÷ label weight). This guards against wrong supplier labels. `computePaperCost` in `lib/material-suggestion.js`.
- **Bag weight** = calculated height × calculated width × GSM of the matched roll (`lib/paper-sizing.js`, client-safe). Shown in the Recommended Materials dialog (paper row), the Admin/Manager review line summary, and the warehouse pick page (with the kg of paper for the order).
- **Paper rolls can be priced per kg** (`CostEntryBasis.PER_KG`): per meter = price/kg × weight ÷ length. The receive form previews per m, per kg and per roll. The entered price is shown in the paper-roll table ("Price entered") and in a Deliveries column on the material page. A roll's page also shows cost per roll and per kg.
- Per-unit cost precision raised to 6 decimals (`averageCostKwd`, `unitCostKwd`), so per-kg and per-meter figures agree.
- Migrations `20260930130000_cost_entry_per_kg`, `20260930140000_unit_cost_precision` (applied).
- **Recycling at slitting** (migration `20260930150000_slitting_recycled_rolls`; replaces the old cut-width/pieces/leftover-action model):
  - The bag keeps its calculated width. The leftover width becomes as many 8.5–9 cm recycled rolls as fit (`planSlitting`, `lib/paper-sizing.js`); the rest is waste.
  - The plan shows on the quote's paper row and pre-fills the slitting form (worker + admin), which the worker can adjust.
  - Each recycled roll is its own paper roll: type Recycled, the parent's color/GSM/supplier, its own width/length/weight, barcode = parent + `-1`, `-2`…, received into factory stock. `Material.parentRollId` / `recycledAtStageId` link them.
  - Re-recording the stage replaces its recycled rolls unless one was moved or used. Waste is kept as width + kg on the stage (`slitWasteWidthCm`, `slitWasteKg`).
  - **Still open:** recycled rolls have no cost yet (the cost split is undecided); nothing consumes them yet (handle making, deferred); PRINT_QC still lets the worker skip slitting.
- **Fixed (pre-existing):** re-recording a completed stage always failed. The duplicate next-stage insert was caught inside the transaction, but Postgres aborts the transaction on any failed statement. The code now checks whether the next stage exists first.

### Cliché chosen in the proposal (2026-09-30)
- **Moved before the quote.** Each printed line in the order form now picks its cliché: **Use existing** (the customer's active clichés, plus ones with no customer) or **Add new** (size H × W, colors, source, ownership, cost). Drafts may leave it open; **Submit for Approval** requires it. **Plain lines (0 colors) need no cliché**, and the send-to-production gate only checks printed lines.
- **A purchased cliché is billed at cost:** `OrderLine.clicheCharge` is part of the order subtotal. It gets its own row on the quote PDF ("Cliché for line N (H × W cm)"), and it's added to the admin review's **Est. Cost (materials + clichés)**. Customer-supplied or already-owned clichés are free.
- A new cliché is created when the proposal is saved, tagged `Cliche.originOrderId`. On edit it stays editable as "Add new". If it's removed from the proposal, or the order is deleted (`deleteSalesOrder`), it is deleted too, unless another order has reused it.
- After approval, clichés are read-only in the review panel (`CustomerQuoteSection`). They can only be changed by editing the order, which sends it back for approval and a new quote. The post-approval assign route `/api/order-lines/[id]/cliche` was removed.
- Clichés are headed by their **size** (H × W cm), not the `CLC-…` code. The code is still shown as a detail.
- **All bag sizes read H × W × B** (`bagSizeLabel` in `lib/order-labels.js`): Admin/Manager/Sales order lists and review dialogs used to show W × H.
- Migration `20260930120000_cliche_in_proposal` (applied).

### Inventory redesign, phase 1 (2026-09-29) — see `docs/INVENTORY_DESIGN.md`
- **Catalog:** non-paper materials are now a catalog (one per supplier + type + subtype). Every delivery is a `StockReceipt` with its own price, and cost is a weighted average. Paper rolls stay one record per barcode.
- **Locations:** stock is tracked per location (Warehouse / Factory) with a signed ledger.
- **Picking** is a Warehouse → Factory transfer, and **production** draws from Factory stock. This fixes two double deductions: pick + stage, and production waste deducted on top of issued paper.
- **Glue and rope:** workers pick the supplier material they used. Rope is counted in meters. Re-recording a stage replaces its movements.
- **Screens:** Receive Stock, material detail with receipt edit/delete, adjustments, and movement history. They are shared by Admin (Materials = stock, Inventory = movements), Manager and Warehouse (one Inventory page with tabs). Warehouse's separate Materials page was removed.
- **Permissions:** Warehouse can now create catalog materials and suppliers and read exchange rates, so receiving never waits for an admin.
- **Needs `npx prisma migrate deploy`** (`20260929120000_material_catalog_stock_locations`, after `20260928120000_cost_currency_eur`). It clears all material/stock data, which is not live and will be re-entered.

### Sales order proposal flow (2026-09-28)
The client's process, now enforced end to end:
1. **Sales, Admin or Manager creates a proposal** → `PENDING_APPROVAL` (or saves a `DRAFT`). Sales are always the rep on their own proposals; Admin/Manager may pick a rep or leave it empty.
2. **Admin/Manager reviews the cost** and approves at the proposed price or a **revised** one (`approvedTotal`).
3. **The quote PDF shows the approved price.** A revision appears as a **"Price adjustment"** row (+/−) under the subtotal so the lines still add up. (Previously the PDF always printed the sales rep's `proposedTotal`, and was rendered before the approved total was saved.)
4. **Quote marked sent → customer confirmation always required** (revised or not) → `CUSTOMER_APPROVED`.
5. **Cliché on every line → only Admin/Manager send to production** (`/send-to-production` is now `requireAdminOrManager`; Sales sees a note instead of the button — `canSendToProduction` prop on `CustomerQuoteSection`).

Server hardening (`lib/services/order-workflow.service.js`, `app/api/orders/*`):
- **Roles:** create/edit/delete/cancel/archive orders now `requireSalesOrAbove` (was `requireAuth` — any role, incl. Worker/Warehouse/Finance, could create or edit orders).
- **No workflow bypass through edit:** `updateSalesOrder` ignores client status — an edit either saves as `DRAFT` (only from DRAFT/REJECTED) or re-submits as `PENDING_APPROVAL`, clearing `approvedTotal`. Previously Admin's "Create & Approve" button sent `READY_FOR_WORK` on edit, skipping approval, quote, cliché gate and stage creation. Orders in production (READY_FOR_WORK onward) can't be edited. Re-saving a pending proposal refreshes its pending `OrderApproval` instead of stacking a new one.
- **Validation:** new shared zod schema `lib/validations/sales-order.js` (`salesOrderSchema`), used by the form for field errors and by POST/PUT on the raw form values (the client never sends transformed output — see the materials "Invalid input" bug below).
- **Totals recomputed server-side** from the lines (`computeOrderTotals`); client-sent subtotal/total are ignored.
- **Order numbers:** `generateOrderNo` = highest existing `PO-YYYY-NNNN` this year + 1 (was `count()+1`, which repeated numbers after any delete), with retry on a same-moment `orderNo` collision.
- **Blank price stays null** (was stored as 0 because `dec("")` returns 0); unit price keeps 3 decimals (0.155 KWD was rounded to 0.16 by the old forms).
- Quote PDF: unit price shown to 3 decimals; size column is **H × W × B**.

UI: one shared order form page replaces the two copy-pasted dialogs (~600 lines each):
- `components/orders/order-form.jsx` (+ `order-form-page.jsx` loader), routed at `/dashboard/sales/orders/{new,[id]/edit}`, `/dashboard/admin/production/{new,[id]/edit}`, `/dashboard/manager/orders/{new,[id]/edit}`. Manager dashboard gained "New Order Proposal" + Edit.
- Manager review dialog now has the same `CustomerQuoteSection` as Admin (mark quote sent, record customer response, assign clichés, send to production), and — like Admin — only shows the price-review inputs while the order is `PENDING_APPROVAL`.
- Sections Customer & Order / Line Items / Pricing; searchable customer picker with **no default** (used to silently pre-select the first customer); per-field, per-line errors with scroll/focus to the first; unsaved-changes guard; edit of an already-approved order warns that it goes back for approval and clears clichés. Admin's misleading "Create & Approve Order" button is gone.

### Materials form → dedicated pages (2026-09-28)
- Create/Edit moved from a modal to `/dashboard/admin/materials/new` and `/dashboard/admin/materials/[id]/edit` (new `GET /api/materials/[id]`, admin-only; stock totals shared via `lib/material-stock.js`). List page shrank from ~2,300 to ~590 lines.
- Redesigned into Material Information / Supplier / Inventory / Identification / Cost Price sections; read-only "Record details" panel on edit; **material type locked on edit** (stock is tracked in the type's unit); "Save & Add Another" (keeps only the material type); unsaved-changes guard; scroll to first error; initial-stock preview for every type using `computeInitialStockQty`.
- Supplier picker uses the shared `SearchableSelect` (same-named suppliers de-duplicated — materials reference suppliers by name).
- Cost price: currency picker attached inline at the end of the amount input.
- **Fixed (pre-existing, from the cost-price commit):** saving a material **without a cost price** failed with "Invalid input" — the form sent zod's transformed output (blank → `null`) and the API re-validated it. Now the raw form is sent.
- Shared `components/unsaved-changes-guard.jsx` (`useUnsavedChangesGuard`, `scrollToFirstError`) used by both the materials and order forms.

### Material cost price & EUR (2026-09-18 → 09-28)
- Material cost price (stored per unit in KWD, with entered currency/basis/rate snapshot), order-line material suggestions with estimated cost, warehouse role with order picking, and a server-side exchange-rate API (Frankfurter, cached 6h).
- **EUR added** alongside USD (`CostCurrency` enum + migration `20260928120000_cost_currency_eur`, `GET /api/exchange-rate?currency=USD|EUR`).

### Materials module (finalized)
- Physical identity split by type: **paper rolls** identified by a required, globally-unique **barcode**; **glue/ink/rope** identified by an optional **batch number + date** (paired together since batch numbers alone aren't guaranteed unique); **tape/sponge/carton** need neither.
- Paper roll gained a weight field; glue/ink relabeled to "weight per pack/drum" with a required pack/drum count; carton now uses "cartons per bundle × number of bundles" instead of a single manual quantity.
- Initial-stock math fixed: it used to pick one field from a priority list (a real bug — "20kg × 15 packs" could post as 20 or 15); now it's an explicit per-type formula (`weight × count`) for every type.
- The internal `code` field is auto-generated server-side but no longer shown or required in the UI — barcode/batch are the user-facing identifiers now. (Kept in the schema rather than dropped, since the old `consumption.service.js` glue/rope auto-pick still does an exact-match lookup on it — see "Known gaps.")
- Negative-stock is a **soft warning**, not a block (deliberate — block-later was explicitly deferred).
- Supplier is now actually required on materials (was visually marked required but silently optional).
- Materials table reordered to: Label, Name, Type, Supplier, Barcode/Batch, Initial Stock, Available Stock, Details, Created At, Actions.
- Cloudinary image uploads (material photos, signatures, evidence) are downscaled/recompressed before upload.
- **AI label scanner** (Claude): removed CARTON/SPONGE from what it tries to detect (not worth the tokens for those); English-only output with translation instructions; ink colors reduced to the plain base color (e.g. "Safanova Red K" → "Red"); a readability gate that refuses to guess and asks for a retake instead of populating wrong data; a two-pass rotation-detection step that physically corrects upside-down/sideways photos before extraction (EXIF auto-orient alone doesn't handle a label that's genuinely upside-down in frame); fixed a "too many optional parameters" API error by making each material type's sub-schema fields required-within-their-branch instead of all-optional.

### Customer Quote Approval + Cliché tracking (new)
Inserted between manager/admin approval and production, matching the client's requested flow:

1. **Manager/Admin approves** → same click auto-generates a PDF quote (order details + the approver's stored signature, or a text fallback if none is set) and moves the order to **"Quote Sent"** (`PENDING_CUSTOMER_APPROVAL`).
2. **Sales (or Admin/Manager) records the customer's response** — this happens outside the system (email/call/signed copy), so it's a manual "Customer Approved / Rejected" action with a required method field ("Signed copy returned," etc.) and an optional evidence upload. Order moves to `CUSTOMER_APPROVED` or `REJECTED`.
3. **Cliché (printing plate) assignment per order line** — search-and-reuse an existing cliché (by code/customer/notes) or log a new one inline (size, color count, company-owned vs. customer-supplied vs. purchased, cost). Reusable master data, not re-entered per order.
4. **Send to Production** — hard gate: stays disabled until every line has a cliché, no override.

Implementation:
- Schema: `User.signatureUrl`, `CustomerQuoteApproval`, `Cliche` models; two new order statuses (`PENDING_CUSTOMER_APPROVAL`, `CUSTOMER_APPROVED`); `OrderLine.clicheId`.
- PDF generated with `@react-pdf/renderer`, uploaded to Cloudinary as an **authenticated/private** asset (not the default public "upload" type — Cloudinary blocks unsigned delivery of raw/PDF files by default, which is exactly what caused an early "link doesn't open" bug). The browser never talks to Cloudinary directly: `GET /api/orders/[id]/quote-pdf` generates a fresh signed download URL server-side and streams the bytes back.
- Service layer: `reviewOrderApproval` (extended), `recordCustomerQuoteResponse`, `sendOrderToProduction` in `lib/services/order-workflow.service.js`; new `lib/services/cliche.service.js`.
- UI: the whole panel (quote PDF link, response form, cliché assignment, send-to-production) is one shared component, `components/orders/customer-quote-section.jsx`, used identically in both the Sales dashboard and the Admin production review dialog — built once, not duplicated, after Admin needed the same controls Sales already had.
- Admin/Manager get a signature-image upload field on a user's edit page (Admin Users management) for ADMIN/MANAGER roles.

### Order stage pipeline (new)
The stage engine (`lib/services/workflow.service.js`) is now wired to the live sales-order flow instead of the retired parallel one:
- `sendOrderToProduction` creates the entry `ProductionStage` (RAW_MATERIAL) per order line; every worker is notified an order is open.
- Flow: RAW_MATERIAL → PRINTING → PRINT_QC → (worker's choice at PRINT_QC) → SLITTING → HANDLE_MAKING_PASTING **or** straight to HANDLE_MAKING_PASTING → QUALITY_CHECK → PACKING → DISPATCH. Stages are created dynamically as each prior one completes (not pre-created — the path branches), via `STAGE_FLOW` in `lib/production-constants.js`.
- Claiming is atomic and first-come-first-served: `POST .../stages/[stageId]/start` (`claimStage`) guards on `status: READY, workerId: null`; a worker must claim before they can submit. ADMIN/MANAGER keep a claim-free override on the same submit endpoint.
- Worker dashboard (`app/dashboard/worker/`) has two pools: "Available Stages" (open, unclaimed) and "My Active Stages" (claimed by you) — replaces the old single-worker "pick the whole order" flow, which is fully retired (`pickWorkerOrder`, `/api/orders/[id]/pick`, the old fixed-8-stage `createProductionOrder` path — all removed or 410'd).
- `STAGE_READY` notification fires (fire-and-forget, non-blocking) every time a new stage opens.
- Stage progress is now surfaced in the UI (see below), via `getOrderLineProgressRows`/`getOrderCurrentStageLabel` in `lib/order-progress.js` — these existed unused for a while; they just needed `lines.stages` actually included in the order queries.

### Quote-sent is now an explicit action (revises a previous locked decision)
Previously, approving an order auto-generated the PDF **and** flipped status straight to `PENDING_CUSTOMER_APPROVAL` ("Quote Sent") in the same click — misleading, since nothing had actually been sent yet. Now:
- Approve → order status `APPROVED` (quote PDF still auto-generated, `CustomerQuoteApproval.status: GENERATED`).
- A person clicks "Mark Quote as Sent" (`markQuoteSent` / `POST /api/orders/[id]/mark-quote-sent`) → `CustomerQuoteApproval.status: SENT`, `sentAt` set, order status → `PENDING_CUSTOMER_APPROVAL`. Only then does "Quote Sent" mean what it says.
- Schema: `CustomerApprovalStatus` gained `GENERATED`; `CustomerQuoteApproval` split `sentAt` (nullable, set only on the explicit action) from a new `generatedAt` (always set, when the PDF was produced).

### Other fixes this session
- **Order stages weren't shown anywhere** (only the coarse order status) — `getOrderDetails`/`GET /api/orders` now include `lines.stages`; sales inspect dialog and admin review dialog render a per-line stage badge.
- **Clichés had no browsable view** — added a "View" action on the Customers page (`app/dashboard/admin/customers/page.jsx`) opening a tabbed dialog (Info / Clichés), listing clichés via the existing `GET /api/cliches?customerId=`.
- **"Submit for Approval" stayed clickable with zero changes** on an already-`PENDING_APPROVAL`/`APPROVED` order — Sales' edit dialog now snapshots the order on open and disables the button (shows "Awaiting Approval") unless something actually changed.
- **CSRF signout errors** — Sales and Worker dashboards called the raw NextAuth `/api/auth/signout` endpoint directly (no CSRF token attached client-side); switched both to the app's own CSRF-safe `POST /api/auth/logout` route, matching Admin/Manager.
- **Neon "server has closed the connection" (P1017) errors** — the `pg.Pool` in `lib/prisma.js` had no idle-timeout, so Neon's pooler would close sockets `pg` still considered live. Added `idleTimeoutMillis`/`max` and a pool error handler.
- Confirmed **not** a bug: the `Unique constraint failed on ("barCode")` Prisma log — `POST /api/materials` already catches P2002 and returns a friendly 409; the raw error text is just Prisma's own dev-mode `log: ["error"]` console output alongside the handled response.

### In-app notifications (present, not built this session — documenting current state)
`lib/services/notification.service.js` + `app/api/notifications/*` exist and are wired into the order lifecycle: new order → notifies Manager/Admin; approved/rejected → notifies the sales rep; customer response recorded → notifies the sales rep; sent to production → notifies Workers. No email is sent at any of these points — see "Known gaps."

### Cross-cutting bug fixes found while building the above
- **P2028 transaction timeout** (`"A commit cannot be executed on an expired transaction"`): 5 functions (`reviewOrderApproval`, `recordCustomerQuoteResponse`, `sendOrderToProduction`, and two pre-existing ones — `updateSalesOrder`, `pickWorkerOrder`) were doing a heavy 7-relation order read *and* the audit-log write *inside* Prisma's interactive transaction, which has a 5s default limit — reliably too slow on Neon's pooled connection. Fixed everywhere: transactions now hold only the actual atomic writes; audit log + final read happen after commit.
- **403 Forbidden on new endpoints**: there are two separate authorization layers in this app — the in-route `requireX()` checks, and a completely separate middleware-level path-prefix allowlist (`lib/roleAccess.js`) that runs first. New routes (`/api/cliches`, `/api/order-lines/*`) were missing from that allowlist and got blocked regardless of role until added.
- **Order-creation dialog field overlap**: `SelectTrigger` defaults to `w-fit` + `whitespace-nowrap` with no width constraint at the call sites, so a long value (e.g. a sales rep's "Name (email)") grew past its grid column into the next one. Fixed with `w-full` on every trigger + `min-w-0` on the grid-cell wrappers, in both the Sales and Admin order forms.

---

## Locked decisions
1. Materials identity: barcode (paper rolls) / batch+date (glue, ink, rope) / none (tape, sponge, carton).
2. `code` stays in the schema, hidden from users, auto-generated.
3. Negative stock: warn, don't block (for now).
4. ~~Cliché required on every line before production — hard gate, no override.~~ **Revised 2026-09-30**: a cliché is required on every **printed** line when the proposal is submitted (before the quote); plain lines need none. A purchased cliché is billed to the customer at cost on the quote.
5. ~~Quote PDF generation is automatic on the approve click, not a separate step.~~ **Revised 2026-09-02**: PDF generation is still automatic on approve, but "sent" is now a separate explicit action (`markQuoteSent`) — approving alone no longer claims the quote was sent.
6. Admin's signature is a stored image (uploaded once), not just a printed name.
7. Proposals can be created by Sales, Admin and Manager; approval, customer confirmation and send-to-production only happen through their own actions — never via an order edit.
8. Customer confirmation is **always** required after approval, whether or not the price was revised.
9. A revised price is shown on the quote as a single "Price adjustment" row (line prices unchanged) — per-line price editing by the approver was considered and deferred.
10. Only Admin/Manager send an order to production.
11. Material type can't be changed once a material is created.

---

## Known gaps / suggested next
- **The app's database is Neon, not local.** `.env` has `DATABASE_URL` = a `prisma+postgres://localhost` proxy *and* `PRISMA_URL` = Neon; `lib/databaseUrl.js` / `prisma.config.ts` pick `PRISMA_URL` whenever `DATABASE_URL` starts with `prisma+`. The dev server and `npx prisma` both hit Neon — don't run write tests without confirming it isn't production.
- **EUR migration not yet applied on Neon** — until `npx prisma migrate deploy` runs, saving a material priced in EUR returns a 500.
- **Not yet verified end to end** (no writes were made while testing): creating/editing a proposal, approving with a revised price and downloading the resulting quote, and create/edit/"Save & Add Another" on materials. Read-only browser checks and offline PDF renders passed.
- **Duplicate paper-roll barcode is reported as "Material code already exists."** — `duplicateMaterialErrorMessage` in `app/api/materials/route.js` / `[id]/route.js` doesn't recognise the barCode constraint in the shape this Prisma adapter reports it, so the form can't show it on the Barcode field.
- Superseded quote records from before an edit stay in their old `SENT` status.
- Schema drift not from this work: `prisma migrate diff` reports `OrderLineMaterial.materialId` FK as `ON DELETE SET NULL` in the schema but not in the database.
- The unsaved-changes guard doesn't cover the browser Back button (App Router can't block it).
- Sales/Finance still receive material cost fields (`suggestedCost`, `costPricePerUnit`) from `GET /api/orders`; Warehouse receives order prices — reported by review, not yet verified.
- **No customer email automation yet.** Approval only marks the quote "sent" internally — a human has to actually share the PDF. Email infra already exists (`lib/email.js`, used for password-reset invites) and `Customer.email` is on the record, so this is realistic to add — asked the user, awaiting a decision.
- **`Material.unit` is still a loose string**, not the shared `MaterialUnit` enum — most visible on Kapton/tape, where the form accepts any typed text as the unit.
- **Kapton has no quantity field** in the create form at all, so it never gets an initial-stock transaction.
- **`OrderLine` still isn't linked to real `Material` records** (paper type/color are free text) — this was M1 in the earlier Materials/Orders proposals doc. Partly bridged since 2026-09-18: each line gets best-match `OrderLineMaterial` suggestions (roll/glue/rope/ink, with estimated cost) that the warehouse picks against, but the line itself still has no material FK and there's no availability check at approval time.
- **Stale `bag-specs` code** — an orphaned bag-specs page/API that references a since-removed `BagSpecification` model, still 500s if hit. `workflow.service.js` itself is no longer stale — it's the live stage engine now (see above); its glue/handle-rope *planning* math (`computePlannedGlue`, `getHandleCapacity`) still silently returns 0 since it depended on the removed `BagSpecification`'s per-bag rates, which have no replacement source on `OrderLine` yet — recording still works (operator enters glue kg manually), only the auto-suggested planned quantity is affected.
- **`admin/production/[id]/page.jsx` and `manager/production/[id]/page.jsx`** — per-order detail routes with a fuller stage timeline + an admin "Record" override dialog, but unreachable from any nav link (orphaned since the sales-order flow replaced the old creation path). Worth relinking or removing once someone decides which admin surface is canonical.
- A handful of materials had their barcodes auto-disambiguated (tagged `-DUP2`/`-DUP3`) when the uniqueness constraint was added — worth a manual review pass (search "DUP" in the barcode column).

---

## Key paths

| Area | Path |
|------|------|
| Continuity | `docs/PROJECT_STATUS.md` |
| Earlier architecture audit | `docs/CODEBASE_AUDIT_2026-08-20.md` |
| Materials/Orders proposals | `docs/PROPOSALS_Materials_Orders_2026-08-20.md` |
| Materials list | `app/dashboard/admin/materials/page.jsx`, `materials-table.jsx` |
| Materials form (create/edit pages) | `app/dashboard/admin/materials/material-form.jsx`, `material-fields.jsx`, `material-form-dialogs.jsx`; `lib/material-code.js`, `lib/material-constants.js` |
| Material cost / exchange rate | `lib/cost-price.js`, `lib/exchange-rate.js`, `app/api/exchange-rate` |
| Order proposal form (Sales/Admin/Manager) | `components/orders/order-form.jsx`, `order-form-page.jsx`, `lib/validations/sales-order.js` |
| Unsaved-changes guard | `components/unsaved-changes-guard.jsx` |
| AI label scanner | `app/api/materials/scan-label/route.js` |
| Order workflow (create/approve/quote/send-to-production) | `lib/services/order-workflow.service.js` |
| Stage pipeline (claim/record/branch) | `lib/services/workflow.service.js`, `lib/production-constants.js` (`STAGE_FLOW`) |
| Worker dashboard | `app/dashboard/worker/page.jsx` + `components/` |
| Order stage progress helpers | `lib/order-progress.js` |
| Cliché | `lib/services/cliche.service.js`, `app/api/cliches`, order form (`LineClicheFields`), `lib/order-labels.js` |
| Customers (incl. cliché view tab) | `app/dashboard/admin/customers/page.jsx` |
| Quote PDF | `lib/pdf/quote-document.jsx`, `app/api/orders/[id]/quote-pdf` |
| Shared quote/cliché UI | `components/orders/customer-quote-section.jsx` |
| Sales dashboard | `app/dashboard/sales/page.jsx` |
| Admin production | `app/dashboard/admin/production/page.jsx` |
| Notifications | `lib/services/notification.service.js`, `app/api/notifications/*` |
| Role-based route access (middleware) | `lib/roleAccess.js`, `middleware.js` |
