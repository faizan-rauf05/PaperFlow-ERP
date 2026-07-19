# PaperFlow ERP — Project Status

> **For new chats:** Start with “Continue from `docs/PROJECT_STATUS.md`.”

Last updated: 2026-07-19

---

## Done so far

### Auth & shell
- NextAuth roles: ADMIN, MANAGER, WORKER, SALES, FINANCE
- Theme support, dashboard shells per role

### Materials (current master data)
- Type-driven materials: Paper Roll, Glue, Ink, Rope, Kapton, Sponge, Carton
- Shared fields: Name, Supplier, auto Code (field-derived + unique `T…` suffix)
- Kapton: type dropdown (Flexo / White DS / Machine Black), custom Size + Unit
- Admin Materials page with type filter + sort (Name/Code/Type/Supplier/Newest)
- Inventory is **material ledger only** (no rolls)

### Global UI
- Thin modern scrollbars in `app/globals.css`

### Production redesign (completed)
- **No PaperRoll** — model, APIs, admin nav, and inventory roll picker removed
- **Customer** master (PERSON | COMPANY) + Admin Customers page
- **Bag Specs** admin CRUD (`/dashboard/admin/bag-specs`) — sizes + consumption rates
- **Multi-line orders** — enter free-text **bag size** per line (find/create bag spec); each line owns an 8-stage chain
- **Worker assignment** — required on create (`assignedWorkerId`); stages pre-tagged; reassign on order detail
- **Order list** shows assigned worker + **current stage**
- **8-stage pipeline:** Raw Material Receiving → Slitting → Printing → Print QC → Handle Making & Pasting → Quality Check → Packing → Dispatch
- Bags are created at **Handle Making & Pasting** (meters + rope → bag count)
- Admin **Record input** + **Preview** on order detail; Unlock / worker start-submit deferred (APIs return 410)
- Stage proofs, slitting remainder (WASTE | RESTOCK), auto waste = input − output
- Consumption maps to seeded codes (`GLUE-HOT-25`, `GLUE-COLD-25`, `ROPE-WHT-100-2`)

---

## Locked decisions (do not reverse)
1. **No rolls** — inventory & production link only to **Materials**.
2. Bags emerge at Handle Making & Pasting — not a separate Bag Making stage.
3. Admin-first recording — Worker stage UI deferred (assignment exists; full worker recording UI still deferred).
4. One stage set **per order line**.

### Do not
- Reintroduce PaperRoll / roll selection / Unlock as primary flow
- Treat Handle Making and Pasting as separate stages

---

## Suggested next work
- Worker recording UI (optional), filtered to assigned orders, aligned with admin `record` API
- Deeper inventory restock UX beyond slitting remainder
- End-to-end Admin smoke: Customers → bag size line → assign worker → Record/Preview stages

---

## Key paths

| Area | Path |
|------|------|
| Continuity | `docs/PROJECT_STATUS.md` |
| Customers UI | `app/dashboard/admin/customers/page.jsx` |
| Bag Specs UI | `app/dashboard/admin/bag-specs/page.jsx` |
| Production UI | `app/dashboard/admin/production/` |
| Materials UI | `app/dashboard/admin/materials/page.jsx` |
| Pipeline | `lib/production-constants.js` |
| Order progress | `lib/order-progress.js` |
| Workflow / record | `lib/services/workflow.service.js` |
| Schema | `prisma/schema.prisma` |
| Seed | `prisma/seed.js` |
