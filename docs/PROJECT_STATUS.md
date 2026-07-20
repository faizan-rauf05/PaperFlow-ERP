# PaperFlow ERP — Project Status

> **For new chats:** Start with “Continue from `docs/PROJECT_STATUS.md`.”

Last updated: 2026-07-20

---

## Done so far

### Auth & shell
- NextAuth roles: ADMIN, MANAGER, WORKER, SALES, FINANCE
- Theme support, dashboard shells per role

### Materials
- Type-driven materials; inventory is **material ledger only** (no rolls)

### Production redesign
- Customers, bag specs, multi-line orders, worker assignment
- 8-stage pipeline; bags created at Handle Making & Pasting
- Admin Record + Preview; status-colored badges (same status = same color)
- Order list: multiline per row (bag spec · qty · current stage)
- Bag spec code auto from **name + width + length** (editable); UI label “Bag length” (= former repeat length)
- Slitting: cut width prefilled from bag width; usable = L×pieces − length restock; width leftover WASTE|RESTOCK (user choice); machine required
- Printing input = slit usable meters (L×pieces after restock)
- QC: passed only; rejected auto
- Raw: paper-only + stock hint; over-stock warns
- Handle: glue usage prefilled/editable; packing: carton select → STOCK_OUT
- Order detail summary: paper used / waste / bags

---

## Locked decisions
1. No rolls — materials only  
2. Bags at Handle Making & Pasting  
3. Admin-first recording (worker UI deferred)  
4. One stage chain per order line  

---

## Suggested next
- Worker recording UI for assigned orders  
- Dedicated width-remainder material SKUs (today restocks parent paper with remarks)

---

## Key paths

| Area | Path |
|------|------|
| Continuity | `docs/PROJECT_STATUS.md` |
| Bag Specs | `app/dashboard/admin/bag-specs/page.jsx` |
| Production | `app/dashboard/admin/production/` |
| Slitting math | `lib/slitting-math.js` |
| Workflow | `lib/services/workflow.service.js` |
| Progress / colors | `lib/order-progress.js` |
