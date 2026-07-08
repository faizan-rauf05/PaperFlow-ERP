"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Loader2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField, fieldClassName } from "@/components/ui/form-field";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { machineSchema, MACHINE_STATUSES } from "@/lib/validations/admin-forms";
import { validateForm, clearFieldError, firstErrorMessage } from "@/lib/validations/form-utils";
import { STAGE_PIPELINE } from "@/lib/production-constants";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STATUS_COLORS = {
  ACTIVE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  DOWN: "bg-destructive/15 text-destructive",
  MAINTENANCE: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  INACTIVE: "bg-muted text-muted-foreground",
};

const emptyForm = { machineCode: "", name: "", stageType: "PRINTING", status: "ACTIVE" };

export default function MachinesPage() {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [downtimeMachine, setDowntimeMachine] = useState(null);
  const [downtime, setDowntime] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/machines");
      setMachines(data.machines || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadDowntime(machineId) {
    try {
      const { data } = await api.get(`/machines/${machineId}/downtime`);
      setDowntime(data.downtimes || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  }

  function patchForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => clearFieldError(prev, field));
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setDialogOpen(true);
  }

  function openEdit(m) {
    setEditing(m);
    setForm({ machineCode: m.machineCode, name: m.name, stageType: m.stageType, status: m.status });
    setErrors({});
    setDialogOpen(true);
  }

  async function handleSave() {
    const result = validateForm(machineSchema, form);
    if (!result.success) {
      setErrors(result.errors);
      toast.error(firstErrorMessage(result.errors));
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await api.put(`/machines/${editing.id}`, result.data);
        toast.success("Machine updated");
      } else {
        await api.post("/machines", result.data);
        toast.success("Machine created");
      }
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
          <h1 className="text-2xl font-bold">Machines</h1>
          <p className="text-muted-foreground">Production equipment and downtime tracking</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Machine</Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : machines.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono">{m.machineCode}</TableCell>
                <TableCell>{m.name}</TableCell>
                <TableCell>{m.stageType}</TableCell>
                <TableCell><Badge className={STATUS_COLORS[m.status] || ""}>{m.status}</Badge></TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="sm" onClick={() => { setDowntimeMachine(m); loadDowntime(m.id); }}>Downtime</Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Machine" : "New Machine"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <FormField label="Code" required error={errors.machineCode}>
              <Input className={fieldClassName("", !!errors.machineCode)} value={form.machineCode} onChange={(e) => patchForm("machineCode", e.target.value.toUpperCase())} disabled={!!editing} />
            </FormField>
            <FormField label="Name" required error={errors.name}>
              <Input className={fieldClassName("", !!errors.name)} value={form.name} onChange={(e) => patchForm("name", e.target.value)} />
            </FormField>
            <FormField label="Stage type" required error={errors.stageType}>
              <Select value={form.stageType} onValueChange={(v) => patchForm("stageType", v)}>
                <SelectTrigger className={cn(errors.stageType && "border-destructive")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGE_PIPELINE.map((s) => <SelectItem key={s.stageType} value={s.stageType}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            {editing && (
              <FormField label="Status" error={errors.status}>
                <Select value={form.status} onValueChange={(v) => patchForm("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MACHINE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!downtimeMachine} onOpenChange={() => setDowntimeMachine(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Downtime — {downtimeMachine?.name}</DialogTitle>
          </DialogHeader>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">History</CardTitle></CardHeader>
            <CardContent className="max-h-64 overflow-y-auto">
              {downtime.length === 0 ? (
                <p className="text-sm text-muted-foreground">No downtime records</p>
              ) : downtime.map((d) => (
                <div key={d.id} className="border-b py-2 last:border-0 text-sm">
                  <p className="font-medium">{d.reason}</p>
                  <p className="text-muted-foreground">{formatDateTime(d.startTime)} — {d.endTime ? formatDateTime(d.endTime) : "ongoing"}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </div>
  );
}
