# Proposals — Materials & Order Creation Modules

Date: 2026-08-20
Scope: You're finalizing Materials and Order Creation in parallel. Each item below is grounded in the current schema/code (cited), not invented. Nothing here has been implemented — this is for you to pick from, module by module, so alignment stays incremental like the rest of the project.

Scale target stated: ~40 daily users, single Postgres instance via Prisma. That's a small-to-mid concurrent load — most of these are about data integrity and avoiding silent drift, not about needing distributed-systems machinery.

---

## MATERIALS MODULE

### M1. Order lines reference paper by free text, not by the actual Material record

**Current state:** `OrderLine.paperType` / `paperColor` (`prisma/schema.prisma:314-315`) are plain strings. The Sales order form (`app/dashboard/sales/page.jsx:60-68`) has its own hardcoded `PAPER_TYPES`/`PAPER_COLORS` lists (`VIRGIN/RECYCLED`, `WHITE/BROWN`). The Materials module has its own, separately maintained lists in `lib/material-constants.js` (`PAPER_TYPES`, `PAPER_COLORS`, plus GSM/width presets). There is no `materialId` on `OrderLine` at all — the two modules don't reference each other's data.

This is almost certainly the "mismatching" you ran into when the client started adding real materials: a new paper variant added in Materials has no way to show up in the Order form, because the Order form doesn't read from Materials at all.

- **Purpose of fixing:** Order lines would state the actual material to be consumed, sourced from what's really in stock — enabling availability checks, correct consumption postings, and one source of truth for paper types/colors instead of two hardcoded lists that can drift.
- **Good:** Matches standard ERP practice (a sales/production line always points at an item master record). Enables stock-check-on-order, auto-consumption later, and kills the duplicate-enum drift permanently.
- **Bad:** Real schema + UI change — adds a required relation to `OrderLine`, changes the order form from free-text pickers to a material lookup, and needs a decision on what happens to existing orders that only have free-text paper type/color. Also couples Order creation to Materials being fully finalized first (you said these are running in parallel — this item specifically wants Materials to land first).

### M2. Stock balance is recomputed by scanning the full transaction ledger on every read

**Current state:** `GET /api/materials` (`app/api/materials/route.js:25-53`) loads every `InventoryTransaction` for every material on each request and sums it in JS. `getAllMaterialStock()` (`lib/services/inventory.service.js:27-40`) is worse — it does one query per material (N+1) via `Promise.all`.

- **Purpose of fixing:** Keep read performance flat as transaction history grows over months of daily use, instead of degrading linearly with ledger size.
- **Good:** A cached `currentStock` column on `Material`, updated inside the same DB transaction as each `InventoryTransaction` insert, makes stock reads O(1) regardless of history size. The ledger stays as-is for audit/recompute — this is the standard "ledger + running balance" pattern used in most inventory systems (including accounting ledgers).
- **Bad:** Introduces a denormalized field that can drift from the ledger if any code path writes an `InventoryTransaction` outside `postInventoryTransaction()` — needs discipline (or a DB trigger) to stay correct. At current likely data volumes (dozens of materials, thousands of transactions) this may not be a felt problem yet — worth deferring until you notice the materials page getting slow, rather than doing it preemptively.

### M3. No negative-stock guard on consumption

**Current state:** `postInventoryTransaction()` (`lib/services/inventory.service.js:50-76`) only checks `qty > 0`. It never checks whether a `STOCK_OUT`/`WASTE` would take a material below zero.

- **Purpose of fixing:** Catch data-entry mistakes (e.g., a worker fat-fingering a consumption quantity) before they silently produce a negative stock figure that then looks like a bug in reports.
- **Good:** Cheap check, catches a real class of operator error, standard in inventory systems (usually a hard block or at least a warning that requires override).
- **Bad:** If any current workflow legitimately needs to post consumption before stock-in is recorded (e.g., backdated corrections), a hard block would need an "allow negative with reason" escape hatch — otherwise it'll block legitimate edge cases.

### M4. `Material.unit` is a free string, not the `MaterialUnit` enum

**Current state:** `Material.unit` is `String` (`prisma/schema.prisma:105`), while `InventoryTransaction.unit`, `StageConsumption.unit`, etc. are all the `MaterialUnit` enum (`KG/METER/BAG/CARTON/PCS`). Nothing stops a material's `unit` from being typo'd or set to a value that doesn't match the enum used everywhere else it's consumed.

- **Purpose of fixing:** Guarantee every unit-conversion and consumption calculation is working with a value that's actually valid, at the database level rather than by convention.
- **Good:** One-line schema change (`String` → `MaterialUnit`), closes a real correctness gap, Prisma migration is low-risk if all current data already holds valid enum values (worth checking before migrating).
- **Bad:** If any existing `Material.unit` values in the DB don't match the enum exactly (case, spelling), the migration fails until cleaned up — needs a quick data audit first.

### M5. No batch/lot traceability on incoming stock

**Current state:** The old `PaperRoll` model (removed) used to carry batch/lot number, supplier, GSM, width per physical roll. That's gone — `Material` is now type-level only (e.g., "Virgin White Paper 90cm 120gsm"), and `InventoryTransaction` has no batch/lot field at all.

- **Purpose of fixing:** If a defect or quality issue traces back to "that shipment from Supplier X on that date," you currently have no way to isolate which stock-in transaction(s) it came from — you'd only know the material type, not the specific batch.
- **Good:** A lightweight `batchNo`/`supplierRef` optional field on `InventoryTransaction` (not a full roll-entity revival) gives traceability back to a specific stock-in event without reintroducing the roll-level complexity that was deliberately removed.
- **Bad:** Only useful if it's actually captured consistently at stock-in time (a manual field that gets skipped is worthless) and if wastage/QC recording is later linked back to it — which is more workflow discipline than schema work. If traceability-to-batch isn't something the client has asked for, this is speculative and can wait.

---

## ORDER CREATION MODULE

### O1. Order numbering has a race condition under concurrent creation

**Current state:** `generateOrderNo()` (`lib/services/order-workflow.service.js`) does `prisma.productionOrder.count()` then formats `PO-YYYY-{count+1}`, outside any transaction. Two sales users submitting orders in the same moment can both read the same count and generate the same `orderNo`.

- **Purpose of fixing:** At 40 daily users with multiple sales reps potentially creating orders concurrently, this isn't a theoretical edge case — it's a plausible daily occurrence.
- **Good:** `orderNo` is already `@unique` in the schema, so the failure mode today is a clean error (second insert fails with P2002) rather than silent duplication — no data corruption risk. Fix is contained: either a retry-on-conflict loop around order creation, or a Postgres sequence per year.
- **Bad:** Currently the caller sees a raw 500/"internal server error" on collision rather than an automatic retry or friendly message — so even without changing the numbering scheme, the error handling in `POST /api/orders` should distinguish this case. Worth deciding whether you want gapless sequential numbers (harder, needs a lock) or just guaranteed-unique-with-retry (simpler, small gaps possible on failed submits).

### O2. No inventory availability check before approval

**Current state:** `Manager` approves an order (`app/dashboard/manager/page.jsx:103`) purely on price/terms — there's no check of whether the paper/ink/glue the order will need is actually in stock.

- **Purpose of fixing:** Prevents approving orders that immediately get stuck at the raw-material stage because the paper isn't there — catches the problem at approval time instead of on the shop floor.
- **Good:** Standard MRP behavior (soft check before committing an order to production). Even a simple "this order needs ~X meters of Virgin White paper, you have Y in stock" advisory (not a hard block) adds real value with modest effort.
- **Bad:** Depends on M1 (order lines pointing at real Material records) being done first — without a material link, there's nothing concrete to check availability against. Also, a hard block could be wrong in practice if more stock is expected to arrive before production starts — probably wants to be a warning, not an enforcement gate, unless you say otherwise.

### O3. Two order-creation schemas exist, one stale

**Current state:** `productionOrderSchema` (`lib/validations/admin-forms.js:225-227`) still requires `assignedWorkerId` — this belongs to the old `/api/production/orders` flow already flagged in the earlier audit (`docs/CODEBASE_AUDIT_2026-08-20.md`). The live Sales-created-order flow doesn't use this schema.

- **Purpose of fixing:** Avoid a validator staying in the codebase that enforces a requirement ("must assign worker at creation") that directly contradicts the requirement you already gave ("remove assign worker from add order").
- **Good:** Straightforward once you're ready to retire the old production-order flow — this is cleanup, not new design.
- **Bad:** You said stale code cleanup can wait until we're working on that module — flagging it here only so it's not forgotten, not proposing action now.

---

## Summary — what needs your call

| # | Item | Depends on |
|---|---|---|
| M1 | Order lines reference real Material records | — (foundational; O2 depends on this) |
| M2 | Cached stock balance instead of full-ledger scan | — (can defer until it's actually slow) |
| M3 | Negative-stock guard on consumption | — |
| M4 | `Material.unit` → proper enum | Needs a quick data audit first |
| M5 | Batch/lot traceability on stock-in | Only if traceability-to-batch matters to the client |
| O1 | Fix order-number race condition | — |
| O2 | Inventory availability check at approval | M1 |
| O3 | Retire stale `productionOrderSchema` | Deferred — old-flow cleanup |

Tell me which of these you want to act on now vs. later, and I'll scope the actual change for the one(s) you pick.
