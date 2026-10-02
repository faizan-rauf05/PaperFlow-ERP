"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PackagePlus, Plus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { inventoryConfigFor } from "@/lib/inventory-routes";
import { AdjustStockDialog } from "./adjust-stock-dialog";
import { CatalogMaterialDialog } from "./catalog-material-dialog";
import { MovementHistory } from "./movement-history";
import { StockOverview } from "./stock-overview";

/**
 * Inventory screen shared by Admin, Manager and Warehouse: stock by material
 * and location, and the movement history, with Receive / New Material /
 * Adjust actions. `tab` is "stock" or "movements".
 */
export function InventoryHub({ role, tab = "stock" }) {
  const router = useRouter();
  const config = inventoryConfigFor(role);
  const [reloadKey, setReloadKey] = useState(0);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [newMaterialOpen, setNewMaterialOpen] = useState(false);
  const reload = () => setReloadKey((k) => k + 1);

  const tabs = [
    { key: "stock", label: "Stock", href: config.stockHref },
    { key: "movements", label: "Movements", href: config.movementsHref },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-sm text-muted-foreground">Stock in the warehouse and on the factory floor.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {config.canCorrect && (
            <Button variant="secondary" className="border" onClick={() => setAdjustOpen(true)}>
              <SlidersHorizontal className="h-4 w-4" /> Adjust Stock
            </Button>
          )}
          <Button variant="secondary" className="border" onClick={() => setNewMaterialOpen(true)}>
            <Plus className="h-4 w-4" /> New Material
          </Button>
          <Button asChild>
            <Link href={config.receiveHref}>
              <PackagePlus className="h-4 w-4" /> Receive Stock
            </Link>
          </Button>
        </div>
      </div>

      <nav className="flex gap-1 border-b">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "movements" ? (
        <MovementHistory role={role} reloadKey={reloadKey} />
      ) : (
        <Suspense fallback={null}>
          <StockOverview role={role} reloadKey={reloadKey} />
        </Suspense>
      )}

      <AdjustStockDialog open={adjustOpen} onOpenChange={setAdjustOpen} onDone={reload} />
      <CatalogMaterialDialog
        open={newMaterialOpen}
        onOpenChange={setNewMaterialOpen}
        onSaved={reload}
        onUseExisting={(existing) => router.push(config.materialHref(existing.id))}
      />
    </div>
  );
}
