"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { inventoryConfigFor } from "@/lib/inventory-routes";
import { InventoryHub } from "./inventory-hub";
import { MaterialDetail } from "./material-detail";
import { ReceiveStockForm } from "./receive-stock-form";

/**
 * Route bodies for the inventory screens. Each dashboard role's page files
 * are one-liners rendering these with their role (see lib/inventory-routes).
 */

function Spinner() {
  return (
    <div className="flex justify-center py-24 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

function InventoryFromQuery({ role }) {
  const tab = useSearchParams().get("tab") === "movements" ? "movements" : "stock";
  return <InventoryHub role={role} tab={tab} />;
}

/** Inventory hub whose tab comes from ?tab= (Manager/Warehouse have one page for both tabs). */
export function InventoryPage({ role }) {
  return (
    <Suspense fallback={<Spinner />}>
      <InventoryFromQuery role={role} />
    </Suspense>
  );
}

function ReceiveFromQuery({ role }) {
  const params = useSearchParams();
  const type = params.get("type");
  const preset = type ? { materialType: type, materialId: params.get("materialId") || "" } : null;
  return <ReceiveStockForm role={role} preset={preset} />;
}

/** Receive Stock; ?type=GLUE&materialId=… pre-selects the material ("Receive More"). */
export function ReceivePage({ role }) {
  return (
    <Suspense fallback={<Spinner />}>
      <ReceiveFromQuery role={role} />
    </Suspense>
  );
}

/** One material, from the route's [id]. */
export function MaterialDetailPage({ role }) {
  const { id } = useParams();
  return <MaterialDetail key={id} role={role} materialId={id} />;
}

/** Edit Receipt (Admin/Manager), loading the receipt from the route's [id]. */
export function ReceiptEditPage({ role }) {
  const { id } = useParams();
  const config = inventoryConfigFor(role);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/inventory/receipts/${id}`)
      .then(({ data }) => !cancelled && setReceipt(data.receipt))
      .catch((e) => !cancelled && setError(getApiErrorMessage(e, "Could not load this receipt.")));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Button variant="secondary" size="sm" asChild className="border">
          <Link href={config.stockHref}>
            <ArrowLeft className="h-4 w-4" /> Back to Inventory
          </Link>
        </Button>
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      </div>
    );
  }
  if (!receipt) return <Spinner />;
  return <ReceiveStockForm key={receipt.id} role={role} receipt={receipt} />;
}
