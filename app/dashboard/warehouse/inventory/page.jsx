"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, PlusCircle, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { MATERIAL_TYPE_LABELS } from "@/lib/material-constants";
import { getMaterialSummary } from "@/lib/material-code";

const MATERIAL_UNITS = ["KG", "METER", "PCS", "BAG", "CARTON"];

const emptyForm = {
  materialId: "",
  quantity: "",
  unit: "",
  barcodeInput: "",
  referenceId: "",
  remarks: "",
};

export default function WarehouseInventoryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [materials, setMaterials] = useState([]);
  const [search, setSearch] = useState("");
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/materials");
      setMaterials(data.materials || []);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return materials.filter((m) => {
      if (filterLowStock && !m.isLowStock) return false;
      if (!q) return true;
      return (
        m.name?.toLowerCase().includes(q) ||
        m.code?.toLowerCase().includes(q) ||
        m.barCode?.toLowerCase().includes(q) ||
        m.supplier?.toLowerCase().includes(q)
      );
    });
  }, [materials, search, filterLowStock]);

  function openStockIn(material) {
    setForm({
      ...emptyForm,
      materialId: material?.id || "",
      unit: material?.unit || "",
      barcodeInput: material?.barCode || "",
    });
    setDialogOpen(true);
  }

  function findByBarcode(code) {
    if (!code) return null;
    return materials.find((m) => m.barCode && m.barCode.toLowerCase() === code.trim().toLowerCase());
  }

  function handleBarcodeKeyDown(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const match = findByBarcode(form.barcodeInput);
    if (match) {
      setForm((f) => ({ ...f, materialId: match.id, unit: match.unit }));
      toast.success(`Matched: ${match.name}`);
    } else {
      toast.error("No material found for that barcode");
    }
  }

  async function submitStockIn() {
    if (!form.materialId) {
      toast.error("Select or scan a material first");
      return;
    }
    if (!form.quantity || Number(form.quantity) <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    if (!form.unit) {
      toast.error("Select a unit");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/inventory/transactions", {
        materialId: form.materialId,
        transactionType: "STOCK_IN",
        quantity: Number(form.quantity),
        unit: form.unit,
        referenceId: form.referenceId || undefined,
        remarks: form.remarks || undefined,
      });
      toast.success("Stock received");
      setDialogOpen(false);
      setForm(emptyForm);
      await load();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-page-title">Inventory</h1>
          <p className="text-sm text-muted-foreground">Current stock levels and receiving.</p>
        </div>
        <Button onClick={() => openStockIn(null)}>
          <PlusCircle className="h-4 w-4 mr-2" /> Receive Stock
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
          <CardTitle className="text-base">Materials</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, code, barcode, supplier"
                className="pl-8 w-64"
              />
            </div>
            <Button
              variant={filterLowStock ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterLowStock((v) => !v)}
            >
              Low stock only
            </Button>
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
                  <TableHead>Barcode</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <p className="font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{getMaterialSummary(m)}</p>
                    </TableCell>
                    <TableCell>{MATERIAL_TYPE_LABELS[m.materialType] || m.materialType}</TableCell>
                    <TableCell className="font-mono text-xs">{m.barCode || "—"}</TableCell>
                    <TableCell>{m.supplier || "—"}</TableCell>
                    <TableCell className="text-right">
                      {m.availableStock} {m.unit}
                    </TableCell>
                    <TableCell>
                      {Number(m.availableStock) <= 0 ? (
                        <Badge variant="destructive">Out of stock</Badge>
                      ) : m.isLowStock ? (
                        <Badge className="bg-amber-500/90 text-white">Low stock</Badge>
                      ) : (
                        <Badge variant="secondary">In stock</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openStockIn(m)}>
                        Receive
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Receive Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Scan or enter barcode</label>
              <div className="relative mt-1">
                <ScanLine className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  autoFocus
                  className="pl-8"
                  value={form.barcodeInput}
                  onChange={(e) => setForm((f) => ({ ...f, barcodeInput: e.target.value }))}
                  onKeyDown={handleBarcodeKeyDown}
                  placeholder="Scan barcode and press Enter"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Material</label>
              <Select
                value={form.materialId}
                onValueChange={(v) => {
                  const mat = materials.find((m) => m.id === v);
                  setForm((f) => ({ ...f, materialId: v, unit: mat?.unit || f.unit, barcodeInput: mat?.barCode || f.barcodeInput }));
                }}
              >
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Select a material" />
                </SelectTrigger>
                <SelectContent>
                  {materials.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Quantity</label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  className="mt-1"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Unit</label>
                <Select value={form.unit} onValueChange={(v) => setForm((f) => ({ ...f, unit: v }))}>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {MATERIAL_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Supplier reference (optional)</label>
              <Input
                className="mt-1"
                value={form.referenceId}
                onChange={(e) => setForm((f) => ({ ...f, referenceId: e.target.value }))}
                placeholder="PO number, delivery note, etc."
              />
            </div>

            <div>
              <label className="text-sm font-medium">Remarks (optional)</label>
              <Input
                className="mt-1"
                value={form.remarks}
                onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submitStockIn} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirm Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
