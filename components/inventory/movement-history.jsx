"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { cn, formatDateTime } from "@/lib/utils";
import { formatQuantity } from "@/lib/material-catalog";
import { MOVEMENT_TYPE_LABELS, MOVEMENT_TYPE_STYLE, STOCK_LOCATION_OPTIONS } from "@/lib/stock-locations";
import { inventoryConfigFor } from "@/lib/inventory-routes";
import { LocationBadge } from "./stock-figures";

const PAGE_SIZE = 50;

/**
 * Stock movements (the ledger), newest first, filterable by location and
 * type. Pass `materialId` to show one material's movements (material page).
 */
export function MovementHistory({ role, materialId = null, reloadKey = 0, compact = false }) {
  const config = inventoryConfigFor(role);
  const [location, setLocation] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ movements: [], totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPage(1);
  }, [location, type, materialId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = {
      page,
      limit: PAGE_SIZE,
      ...(materialId ? { materialId } : {}),
      ...(location !== "ALL" ? { location } : {}),
      ...(type !== "ALL" ? { type } : {}),
    };
    api
      .get("/inventory/history", { params })
      .then(({ data: res }) => !cancelled && setData(res))
      .catch((e) => !cancelled && toast.error(getApiErrorMessage(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, location, type, materialId, reloadKey]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All locations</SelectItem>
            {STOCK_LOCATION_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All movement types</SelectItem>
            {Object.entries(MOVEMENT_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">{data.total.toLocaleString()} movements</span>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Date</th>
              {!compact && <th className="px-4 py-2.5">Material</th>}
              <th className="px-4 py-2.5">Movement</th>
              <th className="px-4 py-2.5">Location</th>
              <th className="px-4 py-2.5 text-right">Change</th>
              <th className="px-4 py-2.5">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-10 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </td>
              </tr>
            ) : data.movements.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-muted-foreground">
                  No stock movements yet.
                </td>
              </tr>
            ) : (
              data.movements.map((m) => (
                <tr key={m.id} className="border-b last:border-b-0">
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</td>
                  {!compact && (
                    <td className="px-4 py-2">
                      <Link href={config.materialHref(m.material.id)} className="hover:underline">
                        {m.material.materialType === "PAPER_ROLL" ? (
                          <span className="font-mono text-xs">{m.material.barCode}</span>
                        ) : (
                          m.material.name
                        )}
                      </Link>
                      <p className="text-xs text-muted-foreground">{m.material.supplier?.name}</p>
                    </td>
                  )}
                  <td className="px-4 py-2">
                    <Badge variant="outline" className={cn("font-medium", MOVEMENT_TYPE_STYLE[m.transactionType])}>
                      {MOVEMENT_TYPE_LABELS[m.transactionType] || m.transactionType}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    <LocationBadge location={m.location} />
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-4 py-2 text-right font-mono tabular-nums",
                      Number(m.quantity) > 0 && "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {Number(m.quantity) > 0 ? "+" : "−"}
                    {formatQuantity(Math.abs(Number(m.quantity)), m.unit)}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {[m.remarks, m.referenceId && m.referenceId !== m.remarks ? m.referenceId : null, m.createdBy?.name]
                      .filter(Boolean)
                      .join(" · ")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-muted-foreground">
            Page {page} of {data.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
