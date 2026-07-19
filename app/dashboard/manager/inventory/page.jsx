"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";

export default function ManagerInventoryPage() {
  const [stock, setStock] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ materialId: "", quantity: "", unit: "METER", remarks: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [stockRes, lowRes, matsRes] = await Promise.all([
        api.get("/inventory/current-stock"),
        api.get("/inventory/low-stock"),
        api.get("/materials"),
      ]);
      setStock(stockRes.data.stock || []);
      setLowStock(lowRes.data.items || []);
      setMaterials(matsRes.data.materials || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleStockIn() {
    setSaving(true);
    try {
      await api.post("/inventory/transactions", {
        transactionType: "STOCK_IN",
        materialId: form.materialId,
        quantity: Number(form.quantity),
        unit: form.unit,
        remarks: form.remarks || "Manager stock-in",
      });
      toast.success("Stock-in posted");
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">Read-only stock view with stock-in posting</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Stock In</Button>
      </div>

      {lowStock.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" /> Low Stock ({lowStock.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {lowStock.map((m) => (
              <Badge key={m.id} variant="outline">{m.name}: {m.currentStock} {m.unit}</Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : stock.map((s) => (
          <Card key={s.id}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{s.code}</p>
              <p className="font-semibold">{s.name}</p>
              <p className="text-2xl font-bold mt-1">{s.currentStock} <span className="text-sm font-normal text-muted-foreground">{s.unit}</span></p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Paper rolls section removed — material ledger only */}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Post Stock In</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Material</Label>
              <Select value={form.materialId} onValueChange={(v) => setForm({ ...form, materialId: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{materials.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Quantity</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["KG", "METER", "PCS", "BAG", "CARTON"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Remarks</Label><Input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleStockIn} disabled={saving || !form.materialId || !form.quantity}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
