# PaperFlow ERP — Project Status

> **For new chats:** Start with "Continue from `docs/PROJECT_STATUS.md`."

Last updated: 2026-09-02

---

## Done so far

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
4. Cliché required on every line before production — hard gate, no override.
5. ~~Quote PDF generation is automatic on the approve click, not a separate step.~~ **Revised 2026-09-02**: PDF generation is still automatic on approve, but "sent" is now a separate explicit action (`markQuoteSent`) — approving alone no longer claims the quote was sent.
6. Admin's signature is a stored image (uploaded once), not just a printed name.

---

## Known gaps / suggested next
- **No customer email automation yet.** Approval only marks the quote "sent" internally — a human has to actually share the PDF. Email infra already exists (`lib/email.js`, used for password-reset invites) and `Customer.email` is on the record, so this is realistic to add — asked the user, awaiting a decision.
- **`Material.unit` is still a loose string**, not the shared `MaterialUnit` enum — most visible on Kapton/tape, where the form accepts any typed text as the unit.
- **Kapton has no quantity field** in the create form at all, so it never gets an initial-stock transaction.
- **`OrderLine` still isn't linked to real `Material` records** (paper type/color are free text) — this was M1 in the earlier Materials/Orders proposals doc and is still open; blocks a real inventory-availability check at approval time.
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
| Materials | `app/dashboard/admin/materials/page.jsx`, `lib/material-code.js`, `lib/material-constants.js` |
| AI label scanner | `app/api/materials/scan-label/route.js` |
| Order workflow (create/approve/quote/send-to-production) | `lib/services/order-workflow.service.js` |
| Stage pipeline (claim/record/branch) | `lib/services/workflow.service.js`, `lib/production-constants.js` (`STAGE_FLOW`) |
| Worker dashboard | `app/dashboard/worker/page.jsx` + `components/` |
| Order stage progress helpers | `lib/order-progress.js` |
| Cliché | `lib/services/cliche.service.js`, `app/api/cliches`, `app/api/order-lines/[id]/cliche` |
| Customers (incl. cliché view tab) | `app/dashboard/admin/customers/page.jsx` |
| Quote PDF | `lib/pdf/quote-document.jsx`, `app/api/orders/[id]/quote-pdf` |
| Shared quote/cliché UI | `components/orders/customer-quote-section.jsx` |
| Sales dashboard | `app/dashboard/sales/page.jsx` |
| Admin production | `app/dashboard/admin/production/page.jsx` |
| Notifications | `lib/services/notification.service.js`, `app/api/notifications/*` |
| Role-based route access (middleware) | `lib/roleAccess.js`, `middleware.js` |
