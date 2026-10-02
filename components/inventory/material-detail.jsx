"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowLeftRight,
  Coins,
  Eye,
  Factory,
  Layers,
  Loader2,
  PackagePlus,
  Pencil,
  SlidersHorizontal,
  Trash2,
  Warehouse,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { cn, formatDateTime } from "@/lib/utils";
import { MATERIAL_TYPE_LABELS, PAPER_COLORS, PAPER_TYPES } from "@/lib/material-constants";
import { MATERIAL_TYPE_CONFIG, UNIT_SINGULAR, enteredPriceLabel, formatQuantity, packEquivalent } from "@/lib/material-catalog";
import { LOCATION_STYLE } from "@/lib/stock-locations";
import { inventoryConfigFor } from "@/lib/inventory-routes";
import { AdjustStockDialog } from "./adjust-stock-dialog";
import { CatalogMaterialDialog } from "./catalog-material-dialog";
import { ImageLightbox } from "./image-lightbox";
import { MovementHistory } from "./movement-history";
import { LocationBadge, StockQuantity, formatKwd } from "./stock-figures";
import { TransferDialog } from "./transfer-dialog";

const labelOf = (options, value) => options.find((o) => o.value === value)?.label || value;

function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm">{children}</dd>
    </div>
  );
}

const receiptPrice = (r) => ({ amount: r.costAmount, currency: r.costCurrency, basis: r.costEntryBasis });

function receiptQuantity(r, unit) {
  if (r.packSize && r.packCount) {
    return `${r.packCount} × ${formatQuantity(r.packSize, unit)} = ${formatQuantity(r.quantity, unit)}`;
  }
  return formatQuantity(r.quantity, unit);
}

/** One material: stock per location, cost, its deliveries and its movements. */
export function MaterialDetail({ role, materialId }) {
  const router = useRouter();
  const config = inventoryConfigFor(role);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // The material as the Move/Adjust dialogs need it (with the latest pack size),
  // built once per load so their reset effects don't re-run every render.
  const dialogMaterial = useMemo(
    () => (data ? { ...data.material, lastPackSize: data.receipts.find((r) => r.packSize)?.packSize ?? null } : null),
    [data],
  );
  const dialogMaterials = useMemo(() => (dialogMaterial ? [dialogMaterial] : []), [dialogMaterial]);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/materials/${materialId}`)
      .then(({ data: res }) => !cancelled && setData(res))
      .catch((e) => !cancelled && setError(getApiErrorMessage(e, "Could not load this material.")));
    return () => {
      cancelled = true;
    };
  }, [materialId, reloadKey]);

  if (error) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Button variant="secondary" size="sm" asChild className="border">
          <Link href={config.stockHref}>
            <ArrowLeft className="h-4 w-4" /> Back to Inventory
          </Link>
        </Button>
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const { material: m, receipts, hasHistory } = data;
  // Packed materials (glue drums, rope rolls…) also show stock in packs, sized like the latest delivery.
  const packName = MATERIAL_TYPE_CONFIG[m.materialType]?.pack?.name;
  const packSize = packName ? Number(receipts.find((r) => r.packSize)?.packSize || 0) : 0;
  const isPaper = m.materialType === "PAPER_ROLL";
  const canEditCatalog = config.canCorrect && !isPaper && !hasHistory;

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/materials/${m.id}`);
      toast.success("Material deleted");
      router.push(config.stockHref);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="space-y-3">
        <Button variant="secondary" size="sm" asChild className="border">
          <Link href={config.stockHref}>
            <ArrowLeft className="h-4 w-4" /> Back to Inventory
          </Link>
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{isPaper ? m.barCode : m.name}</h1>
              <Badge variant="outline">{MATERIAL_TYPE_LABELS[m.materialType]}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {isPaper ? `${m.name} · ` : ""}
              {m.supplier?.name}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isPaper && (
              <Button asChild>
                <Link href={`${config.receiveHref}?type=${m.materialType}&materialId=${m.id}`}>
                  <PackagePlus className="h-4 w-4" /> Receive More
                </Link>
              </Button>
            )}
            <Button variant="secondary" className="border" onClick={() => setMoveOpen(true)}>
              <ArrowLeftRight className="h-4 w-4" /> Move Stock
            </Button>
            {config.canCorrect && (
              <Button variant="secondary" className="border" onClick={() => setAdjustOpen(true)}>
                <SlidersHorizontal className="h-4 w-4" /> Adjust Stock
              </Button>
            )}
            {canEditCatalog && (
              <>
                <Button variant="secondary" className="border" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { key: "WAREHOUSE", label: "Warehouse", Icon: Warehouse, accent: LOCATION_STYLE.WAREHOUSE.accent, text: LOCATION_STYLE.WAREHOUSE.text },
          { key: "FACTORY", label: "Factory", Icon: Factory, accent: LOCATION_STYLE.FACTORY.accent, text: LOCATION_STYLE.FACTORY.text },
          { key: "total", label: "Total stock", Icon: Layers, accent: "border-l-primary", text: "text-primary" },
        ].map(({ key, label, Icon, accent, text }) => (
          <div key={key} className={cn("rounded-lg border border-l-4 bg-card px-4 py-3", accent)}>
            <p className={cn("flex items-center gap-1.5 text-xs font-medium", text)}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </p>
            <StockQuantity quantity={m.stock[key]} unit={m.unit} className="mt-1 block text-xl font-semibold" />
            {packSize > 0 && m.stock[key] > 0 && (
              <p className="text-xs text-muted-foreground">{packEquivalent(m.stock[key], packSize, packName, m.unit)}</p>
            )}
          </div>
        ))}
        {config.canSeeCost && (
          <div className="rounded-lg border border-l-4 border-l-violet-500 bg-card px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-violet-700 dark:text-violet-300">
              <Coins className="h-3.5 w-3.5" /> Average cost
            </p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{formatKwd(m.averageCostKwd, 4)}</p>
            <p className="text-xs text-muted-foreground">per {UNIT_SINGULAR[m.unit] || m.unit}</p>
          </div>
        )}
      </div>

      {isPaper && (
        <dl className="grid grid-cols-2 gap-4 rounded-lg border bg-card px-4 py-4 sm:grid-cols-4 sm:px-6">
          <Fact label="Paper">
            {labelOf(PAPER_TYPES, m.paperType)} · {labelOf(PAPER_COLORS, m.paperColor)}
          </Fact>
          <Fact label="Width">{Number(m.paperWidthCm)} cm</Fact>
          <Fact label="GSM">{m.gsm}</Fact>
          <Fact label="Roll weight">{Number(m.weightKg)} kg</Fact>
          <Fact label={m.parentRoll ? "Recycled length" : "Received length"}>
            {formatQuantity(m.paperLengthM, "METER")}
          </Fact>
          {m.parentRoll && (
            <Fact label="Recycled from">
              <Link href={config.materialHref(m.parentRoll.id)} className="font-mono text-xs text-primary hover:underline">
                {m.parentRoll.barCode}
              </Link>
            </Fact>
          )}
          {m.recycledRolls?.length > 0 && (
            <Fact label="Recycled rolls">
              {m.recycledRolls.map((r, i) => (
                <span key={r.id}>
                  {i > 0 && ", "}
                  <Link href={config.materialHref(r.id)} className="font-mono text-xs text-primary hover:underline">
                    {r.barCode}
                  </Link>
                </span>
              ))}
            </Fact>
          )}
          {config.canSeeCost && receipts[0] && (
            <>
              <Fact label="Price entered">{enteredPriceLabel(receiptPrice(receipts[0]), m.materialType, m.unit)}</Fact>
              <Fact label="Cost per roll">{formatKwd(receipts[0].totalCostKwd, 3)}</Fact>
              <Fact label="Cost per kg">{formatKwd(Number(receipts[0].totalCostKwd) / Number(m.weightKg), 4)}</Fact>
            </>
          )}
          <Fact label="Code">
            <span className="font-mono text-xs">{m.code}</span>
          </Fact>
        </dl>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Deliveries</h2>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Received</th>
                <th className="px-4 py-2.5">Into</th>
                <th className="px-4 py-2.5">Quantity</th>
                <th className="px-4 py-2.5">Batch</th>
                {config.canSeeCost && <th className="px-4 py-2.5 text-right">Price entered</th>}
                {config.canSeeCost && <th className="px-4 py-2.5 text-right">Unit cost</th>}
                <th className="px-4 py-2.5">By</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {receipts.length === 0 ? (
                <tr>
                  <td colSpan={config.canSeeCost ? 8 : 6} className="py-8 text-center text-muted-foreground">
                    Nothing received yet.
                  </td>
                </tr>
              ) : (
                receipts.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="whitespace-nowrap px-4 py-2">{new Date(r.receivedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2">
                      <LocationBadge location={r.location} />
                    </td>
                    <td className="px-4 py-2 font-mono text-xs tabular-nums">{receiptQuantity(r, m.unit)}</td>
                    <td className="px-4 py-2 text-xs">
                      {r.batchNo ? `${r.batchNo}${r.batchDate ? ` · ${new Date(r.batchDate).toLocaleDateString()}` : ""}` : "—"}
                    </td>
                    {config.canSeeCost && (
                      <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-xs tabular-nums">
                        {enteredPriceLabel(receiptPrice(r), m.materialType, m.unit)}
                        {r.exchangeRate && (
                          <p className="font-sans text-muted-foreground">1 {r.costCurrency} = {Number(r.exchangeRate)} KWD</p>
                        )}
                      </td>
                    )}
                    {config.canSeeCost && (
                      <td className="px-4 py-2 text-right text-xs">
                        <span className="whitespace-nowrap font-mono tabular-nums">
                          {formatKwd(r.unitCostKwd, 4)}
                          <span className="text-muted-foreground">/{UNIT_SINGULAR[m.unit] || m.unit}</span>
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {r.receivedBy?.name || "—"}
                      <p>{formatDateTime(r.createdAt)}</p>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {r.labelImageUrl && (
                          <Button variant="ghost" size="icon-sm" title="View label photo" onClick={() => setPreviewUrl(r.labelImageUrl)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {config.receiptHref && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={config.receiptHref(r.id)}>Edit</Link>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Stock Movements</h2>
        <MovementHistory role={role} materialId={m.id} reloadKey={reloadKey} compact />
      </section>

      <AdjustStockDialog open={adjustOpen} onOpenChange={setAdjustOpen} material={dialogMaterial} onDone={reload} />
      <TransferDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        materials={dialogMaterials}
        defaultFrom={m.stock.WAREHOUSE > 0 || !(m.stock.FACTORY > 0) ? "WAREHOUSE" : "FACTORY"}
        onDone={reload}
      />
      <CatalogMaterialDialog open={editOpen} onOpenChange={setEditOpen} material={m} onSaved={reload} />
      <ImageLightbox url={previewUrl} onClose={() => setPreviewUrl(null)} />
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {m.name}?</AlertDialogTitle>
            <AlertDialogDescription>It has no deliveries or stock history yet, so it can be removed from the catalog.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
