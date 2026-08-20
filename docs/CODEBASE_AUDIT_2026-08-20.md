# PaperFlow ERP — Codebase Audit

Date: 2026-08-20
Purpose: Reconcile `REQUIREMENTS_STATUS_REPORT.md`, `docs/PROJECT_STATUS.md`, `docs/Implementation_Plan.md`, and `prisma/schema.prisma` against what the code actually does, before planning further work.

---

## 1. The three docs describe three different architectures

| Doc | Date | Order model | Worker assignment | Bag spec |
|---|---|---|---|---|
| `REQUIREMENTS_STATUS_REPORT.md` | Jul 9 | Roll-based inventory (`PaperRoll`), `BagSpecification` table | Assigned at order creation | Separate `BagSpecification` model |
| `docs/PROJECT_STATUS.md` | Jul 20 | Materials-only inventory (no rolls), still assumes bag specs | Assigned at order creation (worker UI deferred) | Still references bag specs |
| `docs/Implementation_Plan.md` | undated (newest) | Sales/business order → Manager/Admin approval → Workers pick themselves | **No** assignment at creation; pick history stored | **No** separate `BagSpecification` table — dimensions/paper/color inline on `OrderLine` |

**`prisma/schema.prisma` matches `Implementation_Plan.md`.** There is no `PaperRoll` or `BagSpecification` model in the current schema. `OrderLine` carries `heightCm/widthCm/baseCm`, `paperType`, `paperColor`, `colorCount`, `withHandle`, `referenceFiles` directly — exactly the "intentionally simple" fields `Implementation_Plan.md` describes. `ProductionOrder` has `salesRepId → User`, `OrderApproval`, and `OrderAssignment` (worker pick history) — all matching the approval/pick workflow.

**Conclusion:** `Implementation_Plan.md` is the current source of truth for direction. `REQUIREMENTS_STATUS_REPORT.md` and `docs/PROJECT_STATUS.md` are superseded and should not be used to judge "what's done" — they describe a schema that no longer exists.

---

## 2. The code itself is mid-migration, not just the docs

There are **two parallel order/production code paths** live at once:

### New path (matches current schema, actively used)
- `app/api/orders/*` (`route.js`, `available/route.js`, `[id]/approve`, `[id]/pick`, `[id]/route.js`)
- `lib/services/order-workflow.service.js` (492 lines) — `createSalesOrder`, `updateSalesOrder`, approval, pick logic
- Wired into: Sales dashboard, Manager dashboard (list + approve), Worker dashboard (available + pick), Admin production list

### Old path (pre-dates the redesign, still live)
- `app/api/production/orders/[id]/*` (detail, `/assign`, `/stages/[stageId]/{start,submit,record,unlock}`)
- `lib/services/workflow.service.js` (740 lines) — `createProductionOrder`, `assignOrderWorker`, `getOrderWithStages`, `recordStage`, `getManagerKpis`
- Wired into: Admin production **detail** page (`admin/production/[id]`), Manager production **detail** page (`manager/production/[id]`)
- Still requires `assignedWorkerId` at creation (`createProductionOrder` throws without it) — contradicts the "remove assign worker from add order" requirement noted at the bottom of `REQUIREMENTS_STATUS_REPORT.md`.
- Contains dead code referencing the removed `BagSpecification` model: `resolveBagSpecId()` (defined, never called) and `stage.orderLine?.bagSpec` (optional-chained, always `undefined` since the relation doesn't exist — silently falls back to defaults, does not crash, but is vestigial and misleading).

### The gap this creates
`createSalesOrder` (the active, new creation path) **only creates `ProductionOrder` + `OrderLine` rows — it never creates `ProductionStage` rows.** The 8-stage pipeline (`RAW_MATERIAL → SLITTING → PRINTING → PRINT_QC → HANDLE_MAKING_PASTING → QUALITY_CHECK → PACKING → DISPATCH`) is only ever instantiated by the *old* `createProductionOrder`, which nothing in the current Sales → Approve → Pick flow calls.

**Net effect:** an order created and approved today via the live Sales/Manager/Worker flow has zero `ProductionStage` records. There is currently no wiring from "order approved → worker picks it → stages appear to record material usage/waste" — which is the core of what you described wanting to build. This is the single most important gap to resolve before adding more features on top.

---

## 3. Orphaned code referencing removed models

- `app/api/bag-specs/route.js` — actively calls `prisma.bagSpecification.findMany/create/update/delete` and `prisma.orderLine.count({ where: { bagSpecId } })`. Neither `bagSpecification` nor `OrderLine.bagSpecId` exist in the current schema. **This route will throw at runtime if called.**
- `app/dashboard/admin/bag-specs/page.jsx` (364 lines) — admin UI for the above, same problem.
- `app/api/rolls/*` — correctly stubbed out (`410 Gone`, "Rolls module has been removed"). `app/dashboard/admin/rolls/page.jsx` is correctly stubbed too. These two are clean and not a concern.
- `lib/material-code.js` still has `PAPER_ROLL`-specific logic (`generatePaperRollBarcode`, etc.) — this is fine, it's about the `Material` model's `PAPER_ROLL` type (a `MaterialType` enum value, still in schema), not the old `PaperRoll` entity model. Not a conflict.

---

## 4. Addendum requirements (bottom of `REQUIREMENTS_STATUS_REPORT.md`) — actual status

| Requirement | Status |
|---|---|
| Order line calculations in cm instead of mm | ✅ Done — `OrderLine.widthCm/heightCm/baseCm`, mm kept only for backward-compat derivation |
| Sales role users linked to order as Sales Rep | ✅ Done — `ProductionOrder.salesRepId → User` ("OrderSalesRep" relation) |
| Per-line "with handle / without handle" field | ✅ Done — `OrderLine.withHandle` |
| Remove assign-worker-from-add-order (workers see it on their dashboard instead) | ⚠️ Done in the **new** flow (`order-workflow.service.js`, `OrderAssignment`-based pick) — **not** done in the **old** flow, which still requires `assignedWorkerId` at creation and still has an "assign" action on the admin/manager detail pages |

---

## 5. Recommendation (not yet actioned)

The new `/api/orders` + `order-workflow.service.js` path is the one aligned with current requirements and schema. The practical next step, when ready, is to:
1. Decide whether the old `workflow.service.js` stage-recording logic (`recordStage`, `getStageRecordContext`, etc.) is reusable as-is or needs rework, then call stage-pipeline creation from `createSalesOrder` (or from the approval/pick transition) so approved+picked orders actually get their 8 `ProductionStage` rows.
2. Retire `assignOrderWorker` / the old "assign" UI action in favor of the `OrderAssignment` pick flow everywhere (admin + manager detail pages included).
3. Delete or rebuild `app/api/bag-specs/*` and `app/dashboard/admin/bag-specs/page.jsx` — currently broken, referencing a removed model.
4. Once the pipeline is reconnected, the material-usage/wastage/reporting goals can build on top of `StageConsumption` + `YieldRecord` + `InventoryTransaction`, which already exist and look sound.

This file is a reference snapshot as of 2026-08-20 — re-verify against the schema/code before relying on it in a future session, since this is exactly the kind of doc that goes stale.
