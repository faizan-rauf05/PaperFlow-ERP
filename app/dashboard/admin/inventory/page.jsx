"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Plus,
  Package,
  Droplet,
  Palette,
  Layers,
  Box,
  FileText,
  CheckCircle2,
  Search,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
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
import { Badge } from "@/components/ui/badge";
import { FormField, fieldClassName } from "@/components/ui/form-field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import {
  inventoryTransactionSchema,
  MATERIAL_UNITS,
  TX_TYPES,
} from "@/lib/validations/admin-forms";
import {
  validateForm,
  clearFieldError,
  firstErrorMessage,
} from "@/lib/validations/form-utils";
import { getMaterialSummary } from "@/lib/material-code";
import { MATERIAL_TYPE_LABELS } from "@/lib/material-constants";
import { cn, formatDateTime } from "@/lib/utils";

const MATERIAL_GROUPS = [
  {
    key: "PAPER_ROLL",
    label: "Paper Roll",
    icon: Package,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    key: "INK",
    label: "Ink",
    icon: Palette,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
  },
  {
    key: "GLUE",
    label: "Glue",
    icon: Droplet,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    key: "ROPE",
    label: "Rope",
    icon: Layers,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    key: "CARTON",
    label: "Carton",
    icon: Box,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
  },
  {
    key: "KAPTON",
    label: "Kapton Tape",
    icon: FileText,
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-500/10 border-indigo-500/20",
  },
  {
    key: "SPONGE",
    label: "Sponge",
    icon: Sparkles,
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-500/10 border-pink-500/20",
  },
];

const emptyForm = {
  transactionType: "STOCK_IN",
  materialId: "",
  quantity: "",
  unit: "METER",
  remarks: "",
};

export default function InventoryPage() {
  const [stock, setStock] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [history, setHistory] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  // Group Detail Modal State
  const [selectedGroupKey, setSelectedGroupKey] = useState(null);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [stockRes, lowRes, histRes, matsRes] = await Promise.all([
        api.get("/inventory/current-stock"),
        api.get("/inventory/low-stock"),
        api.get("/inventory/history"),
        api.get("/materials"),
      ]);
      setStock(stockRes.data.stock || []);
      setLowStock(lowRes.data.items || []);
      setHistory(histRes.data.transactions || []);
      setMaterials(matsRes.data.materials || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Process materials & stock into aggregated 7 Material Group Cards
  const materialGroupSummaries = useMemo(() => {
    const map = new Map();

    MATERIAL_GROUPS.forEach((grp) => {
      map.set(grp.key, {
        ...grp,
        items: [],
        totalAvailableStock: 0,
        lowStockItems: [],
        outOfStockItems: [],
        primaryUnit: "",
      });
    });

    materials.forEach((m) => {
      const typeKey = m.materialType || "OTHER";
      if (!map.has(typeKey)) {
        map.set(typeKey, {
          key: typeKey,
          label: MATERIAL_TYPE_LABELS[typeKey] || typeKey,
          icon: Package,
          color: "text-gray-600",
          bg: "bg-gray-500/10 border-gray-500/20",
          items: [],
          totalAvailableStock: 0,
          lowStockItems: [],
          outOfStockItems: [],
          primaryUnit: "",
        });
      }

      const grp = map.get(typeKey);
      const avail = Number(m.availableStock ?? 0);
      grp.items.push(m);
      grp.totalAvailableStock += avail;
      if (!grp.primaryUnit && m.unit) {
        grp.primaryUnit = m.unit;
      }

      if (avail <= 0) {
        grp.outOfStockItems.push(m);
      } else if (m.isLowStock || avail <= Number(m.minimumStock || 0)) {
        grp.lowStockItems.push(m);
      }
    });

    return Array.from(map.values());
  }, [materials]);

  const activeGroup = useMemo(() => {
    if (!selectedGroupKey) return null;
    return (
      materialGroupSummaries.find((g) => g.key === selectedGroupKey) || null
    );
  }, [selectedGroupKey, materialGroupSummaries]);

  const filteredActiveGroupItems = useMemo(() => {
    if (!activeGroup) return [];
    if (!groupSearchQuery.trim()) return activeGroup.items;
    const q = groupSearchQuery.trim().toLowerCase();
    return activeGroup.items.filter(
      (m) =>
        (m.name || "").toLowerCase().includes(q) ||
        (m.code || "").toLowerCase().includes(q) ||
        (m.supplier || "").toLowerCase().includes(q),
    );
  }, [activeGroup, groupSearchQuery]);

  function patchForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => clearFieldError(prev, field));
  }

  function openDialog(preselectedMaterial = null) {
    setForm({
      ...emptyForm,
      materialId: preselectedMaterial ? preselectedMaterial.id : "",
      unit: preselectedMaterial?.unit || "METER",
    });
    setErrors({});
    setDialogOpen(true);
  }

  async function handlePost() {
    const result = validateForm(inventoryTransactionSchema, form);
    if (!result.success) {
      setErrors(result.errors);
      toast.error(firstErrorMessage(result.errors));
      return;
    }

    setSaving(true);
    try {
      await api.post("/inventory/transactions", result.data);
      toast.success("Transaction posted successfully");
      setDialogOpen(false);
      load();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory Dashboard</h1>
          <p className="text-muted-foreground">
            Category stock summaries, low-stock warnings, and transaction logs
          </p>
        </div>
        <Button onClick={() => openDialog()} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Post Transaction
        </Button>
      </div>

      {/* Global Low Stock Overview Alert if items exist */}
      {lowStock.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5 shadow-xs">
          <CardHeader className="pb-2 py-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" /> Global Low Stock Alerts (
              {lowStock.length} materials requiring attention)
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 flex flex-wrap gap-2">
            {lowStock.map((m) => (
              <Badge
                key={m.id}
                variant="outline"
                className="border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300 gap-1"
              >
                <span className="font-semibold">{m.name}:</span>{" "}
                {m.currentStock} / {m.minimumStock} {m.unit}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 7 Grouped Material Type Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          materialGroupSummaries.map((grp) => {
            const GroupIcon = grp.icon || Package;
            const hasAlerts =
              grp.lowStockItems.length > 0 || grp.outOfStockItems.length > 0;
            const totalAlertCount =
              grp.lowStockItems.length + grp.outOfStockItems.length;

            return (
              <Card
                key={grp.key}
                onClick={() => {
                  setSelectedGroupKey(grp.key);
                  setGroupSearchQuery("");
                }}
                className={cn(
                  "cursor-pointer hover:border-primary/60 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group border",
                  hasAlerts ? "border-amber-500/40" : "hover:border-primary/40",
                )}
              >
                <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <div className={cn("p-2 rounded-lg border", grp.bg)}>
                      <GroupIcon className={cn("h-5 w-5", grp.color)} />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors">
                        {grp.label}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {grp.items.length}{" "}
                        {grp.items.length === 1 ? "variant" : "variants"}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </CardHeader>

                <CardContent className="px-4 py-2">
                  <div className="mt-1">
                    <p className="text-xs text-muted-foreground font-medium">
                      Total Available Stock
                    </p>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                        {grp.totalAvailableStock.toLocaleString()}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground uppercase">
                        {grp.primaryUnit || "UNITS"}
                      </span>
                    </div>
                  </div>
                </CardContent>

                {/* Bottom Highlighted Low / Ended Stock Alert Strip */}
                <div
                  className={cn(
                    "px-4 py-2 text-xs font-medium border-t flex items-center justify-between",
                    grp.outOfStockItems.length > 0
                      ? "bg-destructive/10 text-destructive border-destructive/20"
                      : grp.lowStockItems.length > 0
                        ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30"
                        : "bg-muted/40 text-muted-foreground border-muted",
                  )}
                >
                  {grp.outOfStockItems.length > 0 ? (
                    <span className="flex items-center gap-1.5 font-semibold">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {grp.outOfStockItems.length} out of stock!
                    </span>
                  ) : grp.lowStockItems.length > 0 ? (
                    <span className="flex items-center gap-1.5 font-semibold">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {grp.lowStockItems.length} low stock item
                      {grp.lowStockItems.length > 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 font-normal">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      All {grp.items.length} items healthy
                    </span>
                  )}
                  <span className="text-[11px] text-primary group-hover:underline">
                    View details &rarr;
                  </span>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Transaction History Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <div>
            <CardTitle className="text-lg">
              Recent Inventory Transactions
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Audit log of stock in, stock out, and manual adjustments
            </p>
          </div>
          {/* <Button variant="outline" size="sm" onClick={() => openDialog()}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New Entry
          </Button> */}
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Material</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No recent inventory transactions
                  </TableCell>
                </TableRow>
              ) : (
                history.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(t.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-mono text-xs",
                          t.transactionType === "STOCK_IN"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : t.transactionType === "STOCK_OUT"
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                              : "border-destructive/40 bg-destructive/10 text-destructive",
                        )}
                      >
                        {t.transactionType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {t.material?.name || "—"}{" "}
                      {t.material?.code && (
                        <span className="text-xs text-muted-foreground font-mono">
                          ({t.material.code})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold whitespace-nowrap">
                      {t.quantity} {t.unit}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {t.remarks || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Category Breakdown Itemized Dialog */}
      <Dialog
        open={!!selectedGroupKey}
        onOpenChange={() => setSelectedGroupKey(null)}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          {activeGroup && (
            <>
              <DialogHeader className="pb-3 border-b">
                <div className="flex items-center justify-between pr-6">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn("p-2 rounded-lg border", activeGroup.bg)}
                    >
                      {activeGroup.icon && (
                        <activeGroup.icon
                          className={cn("h-5 w-5", activeGroup.color)}
                        />
                      )}
                    </div>
                    <div>
                      <DialogTitle className="text-lg flex items-center gap-2">
                        {activeGroup.label} Inventory Breakdown
                      </DialogTitle>
                      <p className="text-xs text-muted-foreground">
                        {activeGroup.items.length} materials · Total Stock:{" "}
                        <strong className="text-foreground">
                          {activeGroup.totalAvailableStock.toLocaleString()}{" "}
                          {activeGroup.primaryUnit}
                        </strong>
                      </p>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-3 py-3 flex-1 overflow-y-auto">
                {/* Search inside group */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder={`Search ${activeGroup.label} items by name, code...`}
                    value={groupSearchQuery}
                    onChange={(e) => setGroupSearchQuery(e.target.value)}
                    className="pl-8 text-xs h-8"
                  />
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs">Code & Name</TableHead>
                        <TableHead className="text-xs">
                          Specifications
                        </TableHead>
                        <TableHead className="text-xs text-right">
                          Available Stock
                        </TableHead>
                        <TableHead className="text-xs text-center">
                          Status
                        </TableHead>
                        <TableHead className="text-xs text-right">
                          Action
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredActiveGroupItems.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-center py-6 text-xs text-muted-foreground"
                          >
                            No materials found matching search
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredActiveGroupItems.map((m) => {
                          const avail = Number(m.availableStock ?? 0);
                          const isOut = avail <= 0;
                          const isLow =
                            m.isLowStock ||
                            avail <= Number(m.minimumStock || 0);

                          return (
                            <TableRow key={m.id}>
                              <TableCell className="py-2.5">
                                <p className="font-semibold text-xs text-foreground">
                                  {m.name}
                                </p>
                                <p className="font-mono text-[11px] text-muted-foreground">
                                  {m.code}
                                </p>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground py-2.5">
                                {getMaterialSummary(m) || "—"}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs font-semibold py-2.5 whitespace-nowrap">
                                {avail.toLocaleString()} {m.unit || ""}
                              </TableCell>
                              <TableCell className="text-center py-2.5">
                                {isOut ? (
                                  <Badge
                                    variant="destructive"
                                    className="text-[10px] px-1.5 py-0"
                                  >
                                    Out of Stock
                                  </Badge>
                                ) : isLow ? (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                  >
                                    Low Stock
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                  >
                                    In Stock
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right py-2.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedGroupKey(null);
                                    openDialog(m);
                                  }}
                                  className="h-7 text-xs px-2 text-primary hover:bg-primary/10"
                                >
                                  <Plus className="h-3 w-3 mr-1" /> Post
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <DialogFooter className="pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedGroupKey(null)}
                >
                  Close Breakdown
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Post Transaction Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Post Inventory Transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <FormField
              label="Transaction Type"
              required
              error={errors.transactionType}
            >
              <Select
                value={form.transactionType}
                onValueChange={(v) => patchForm("transactionType", v)}
              >
                <SelectTrigger
                  className={cn(errors.transactionType && "border-destructive")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TX_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Material" required error={errors.materialId}>
              <SearchableSelect
                value={form.materialId}
                onValueChange={(v) => {
                  patchForm("materialId", v);
                  const selMat = materials.find((m) => m.id === v);
                  if (selMat?.unit) {
                    patchForm("unit", selMat.unit);
                  }
                }}
                options={materials.map((m) => ({
                  value: m.id,
                  label: `${m.name}`,
                  description: `Unit: ${m.unit} · Type: ${m.materialType} · Barcode: ${m?.barCode}`,
                }))}
                placeholder="Select material"
                searchPlaceholder="Search material..."
                error={!!errors.materialId}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Quantity" required error={errors.quantity}>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className={fieldClassName("", !!errors.quantity)}
                  value={form.quantity}
                  onChange={(e) => patchForm("quantity", e.target.value)}
                  placeholder="Enter quantity"
                />
              </FormField>

              <FormField label="Unit" required error={errors.unit}>
                <Select
                  value={form.unit}
                  onValueChange={(v) => patchForm("unit", v)}
                >
                  <SelectTrigger
                    className={cn(errors.unit && "border-destructive")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATERIAL_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <FormField label="Remarks" error={errors.remarks}>
              <Input
                className={fieldClassName("", !!errors.remarks)}
                value={form.remarks}
                onChange={(e) => patchForm("remarks", e.target.value)}
                placeholder="Transaction remarks / PO ref..."
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePost} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Post Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
