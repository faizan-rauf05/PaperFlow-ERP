"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { STAGE_PIPELINE } from "@/lib/production-constants";

export default function DefectTypesPage() {
  const [categories, setCategories] = useState([]);
  const [defectTypes, setDefectTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catDialog, setCatDialog] = useState(false);
  const [defectDialog, setDefectDialog] = useState(false);
  const [catForm, setCatForm] = useState({ code: "", name: "" });
  const [defectForm, setDefectForm] = useState({ stageType: "PRINT_QC", code: "", description: "", categoryId: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, defRes] = await Promise.all([
        api.get("/defect-categories"),
        api.get("/defect-types"),
      ]);
      setCategories(catRes.data.categories || []);
      setDefectTypes(defRes.data.defectTypes || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveCategory() {
    setSaving(true);
    try {
      await api.post("/defect-categories", catForm);
      toast.success("Category created");
      setCatDialog(false);
      setCatForm({ code: "", name: "" });
      load();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function saveDefect() {
    setSaving(true);
    try {
      await api.post("/defect-types", defectForm);
      toast.success("Defect type created");
      setDefectDialog(false);
      setDefectForm({ stageType: "PRINT_QC", code: "", description: "", categoryId: "" });
      load();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const qcStages = STAGE_PIPELINE.filter((s) => s.isQc);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Defect Types & Categories</h1>
          <p className="text-muted-foreground">Manage QC defect taxonomy</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCatDialog(true)}><Plus className="h-4 w-4 mr-2" />Category</Button>
          <Button onClick={() => setDefectDialog(true)}><Plus className="h-4 w-4 mr-2" />Defect type</Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Stage</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : defectTypes.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{d.stageType}</TableCell>
                <TableCell className="font-mono">{d.code}</TableCell>
                <TableCell>{d.description}</TableCell>
                <TableCell>{d.category?.name || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New defect category</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <FormField label="Code" required><Input value={catForm.code} onChange={(e) => setCatForm({ ...catForm, code: e.target.value })} /></FormField>
            <FormField label="Name" required><Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} /></FormField>
          </div>
          <DialogFooter>
            <Button onClick={saveCategory} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={defectDialog} onOpenChange={setDefectDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New defect type</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <FormField label="Stage">
              <Select value={defectForm.stageType} onValueChange={(v) => setDefectForm({ ...defectForm, stageType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {qcStages.map((s) => <SelectItem key={s.stageType} value={s.stageType}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Code" required><Input value={defectForm.code} onChange={(e) => setDefectForm({ ...defectForm, code: e.target.value })} /></FormField>
            <FormField label="Description" required><Input value={defectForm.description} onChange={(e) => setDefectForm({ ...defectForm, description: e.target.value })} /></FormField>
            <FormField label="Category">
              <Select value={defectForm.categoryId || "none"} onValueChange={(v) => setDefectForm({ ...defectForm, categoryId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <DialogFooter>
            <Button onClick={saveDefect} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
