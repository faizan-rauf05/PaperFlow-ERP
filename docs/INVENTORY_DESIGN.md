# Inventory Redesign — Material Catalog, Receiving, Stock Locations

Agreed 2026-09-29. Replaces the "one Material row per delivery" model. The existing
material/stock data is **not live** and will be re-entered after this lands, so the
schema is redesigned cleanly (no backfill/compatibility code).

## Decisions

| # | Decision |
|---|---|
| 1 | **Non-paper materials are a catalog**: one `Material` per **supplier + type + subtype**, created once and reused for every delivery. Unique: `(supplierId, materialType, catalogKey)`. |
| 2 | Subtype keys: Glue = glue type · Ink = color · Rope = color · Tape = type + size · Carton = size · Sponge = (none — one per supplier). |
| 3 | **Paper rolls stay one `Material` per physical roll**, identified by a unique barcode, with their own specs. |
| 4 | **Every delivery is a `StockReceipt`**: quantity (pack size × pack count), batch no. + batch date (optional), price (required; KWD/USD/EUR, per unit or per pack), label photo, location, received by/at. |
| 5 | **Cost = weighted average** per material, updated on every receipt. Each receipt keeps its own price for audit. |
| 6 | **Stock has a location**: `WAREHOUSE` or `FACTORY`. Every `InventoryTransaction` records its location and a **signed** quantity (+ in / − out); stock per location = sum of quantities. |
| 7 | Transfers between locations: Warehouse, Admin, Manager. |
| 8 | Order picking becomes a **transfer Warehouse → Factory** (not consumption) — removes today's double deduction (pick + stage both deducted). |
| 9 | Production consumes from **Factory** stock. For glue/ink/rope the **worker picks which supplier's** material was used. Slitting leftovers stay in the Factory. |
| 10 | **Minimum stock is per stock group and location, across all suppliers** (e.g. "Core Glue · Factory · 20 kg"). Paper group = type + color + width. Warnings on Admin, Manager and Warehouse dashboards. |
| 11 | Factory Stock page: Admin & Manager. |
| 12 | Catalog materials can be created by Admin, Manager and Warehouse (inline while receiving). |
| 13 | Price is required on every receipt. |
| 14 | Paper-roll "Save & Add Another" keeps only the material type. |
| 15 | Tape unit is chosen per material (rolls / pieces / meters). |

| 16 | **Production waste is not a stock movement.** Paper issued at Raw Material already left stock; printing waste and a wasted slitting strip are part of those issued meters and are recorded on the stage (waste/yield), not deducted again. Only real movements post: paper issued, usable leftovers returned (RESTOCK), glue/rope/cartons used. Damaged stock is written off with an ADJUSTMENT + reason. |
| 17 | A stage's stock movements are linked to it (`InventoryTransaction.stageId`) and written in the same transaction as the stage; re-recording a stage replaces its movements. |

## Phases

1. **Done (2026-09-29): catalog, receiving, locations, picking and production.**
   - Schema: catalog `Material`, `StockReceipt`, and `InventoryTransaction` with signed quantity, location, transfer and stage links.
   - Stock ledger service with weighted-average cost replay.
   - Receive Stock for all three roles (paper rolls and the AI label scanner included).
   - Material catalog, Stock and Movements screens, material detail with receipt correction, and stock adjustments.
   - Picking is a Warehouse → Factory transfer.
   - Production consumes Factory stock. Glue and rope record the supplier material the worker chose. Rope is counted in meters. Planned glue and rope come from the bag dimensions. Re-recording a stage no longer double-posts.
2. **Transfers: done (2026-09-29).** "Move stock" from a row menu, the material page, or several selected paper rolls at once (`POST /api/inventory/transfers`, all or nothing).
   **Next:** order material suggestions that prefer factory stock, so the warehouse only picks the shortfall.
3. **Then: stock levels and dashboards.** Minimum stock per stock group and location, dashboard warnings, and the Factory Stock page.
