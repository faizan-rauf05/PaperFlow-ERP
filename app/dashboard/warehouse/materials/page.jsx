"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { MATERIAL_TYPE_LABELS, MATERIAL_TYPES } from "@/lib/material-constants";
import { getMaterialSummary } from "@/lib/material-code";

export default function WarehouseMaterialsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [materials, setMaterials] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get("/materials");
        if (!cancelled) setMaterials(data.materials || []);
      } catch (e) {
        if (!cancelled) setError(getApiErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return materials.filter((m) => {
      if (typeFilter !== "ALL" && m.materialType !== typeFilter) return false;
      if (!q) return true;
      return (
        m.name?.toLowerCase().includes(q) ||
        m.code?.toLowerCase().includes(q) ||
        m.barCode?.toLowerCase().includes(q) ||
        m.batchNo?.toLowerCase().includes(q) ||
        m.supplier?.toLowerCase().includes(q)
      );
    });
  }, [materials, search, typeFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title">Materials</h1>
        <p className="text-sm text-muted-foreground">Browse specs, barcodes, and stock — no pricing shown here.</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
          <CardTitle className="text-base">All Materials</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, code, barcode, batch, supplier"
                className="pl-8 w-72"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All types</SelectItem>
                {MATERIAL_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {MATERIAL_TYPE_LABELS[t] || t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading materials...
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">No materials match your search.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Spec</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell>{MATERIAL_TYPE_LABELS[m.materialType] || m.materialType}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{getMaterialSummary(m)}</TableCell>
                    <TableCell className="font-mono text-xs">{m.barCode || "—"}</TableCell>
                    <TableCell>{m.batchNo || "—"}</TableCell>
                    <TableCell>{m.supplier || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span>
                          {m.availableStock} {m.unit}
                        </span>
                        {Number(m.availableStock) <= 0 ? (
                          <Badge variant="destructive" className="text-[10px]">Out of stock</Badge>
                        ) : m.isLowStock ? (
                          <Badge className="bg-amber-500/90 text-white text-[10px]">Low</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
