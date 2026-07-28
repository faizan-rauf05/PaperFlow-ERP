"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Loader2, Search, X, ChevronDown, ChevronRight, ChevronsUp, ChevronsUpDown, Filter } from "lucide-react";
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
import { STAGE_PIPELINE, getStageLabel } from "@/lib/production-constants";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STATUS_COLORS = {
  ACTIVE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  DOWN: "bg-destructive/15 text-destructive border-destructive/30",
  MAINTENANCE: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  INACTIVE: "bg-muted text-muted-foreground border-border",
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

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [groupViewState, setGroupViewState] = useState("expanded");

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

  const filteredMachines = useMemo(() => {
    let list = machines;
    if (statusFilter !== "ALL") {
      list = list.filter((m) => m.status === statusFilter);
    }
    if (stageFilter !== "ALL") {
      list = list.filter((m) => m.stageType === stageFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((m) => {
        const name = (m.name || "").toLowerCase();
        const code = (m.machineCode || "").toLowerCase();
        const stage = (getStageLabel(m.stageType) || "").toLowerCase();
        return name.includes(q) || code.includes(q) || stage.includes(q);
      });
    }
    return list;
  }, [machines, statusFilter, stageFilter, searchQuery]);

  const groupedMachines = useMemo(() => {
    const groupsMap = new Map();

    for (const m of filteredMachines) {
      const key = m.stageType || "OTHER";
      const label = getStageLabel(key);
      if (!groupsMap.has(key)) {
        groupsMap.set(key, { key, label, items: [] });
      }
      groupsMap.get(key).items.push(m);
    }

    return Array.from(groupsMap.values());
  }, [filteredMachines]);

  const toggleGroup = useCallback((groupKey) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
    setGroupViewState("custom");
  }, []);

  const handleExpandAll = useCallback(() => {
    setCollapsedGroups({});
    setGroupViewState("expanded");
  }, []);

  const handleCollapseAll = useCallback(() => {
    const collapsed = {};
    for (const group of groupedMachines) {
      collapsed[group.key] = true;
    }
    setCollapsedGroups(collapsed);
    setGroupViewState("collapsed");
  }, [groupedMachines]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Machines</h1>
          <p className="text-muted-foreground">Production equipment grouped by stage and downtime tracking</p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />Add Machine
        </Button>
      </div>

      {/* Controls Bar */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Live Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by code, machine name, stage..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Expand / Collapse Switch */}
            <div className="flex items-center gap-0.5 bg-muted/60 p-1 rounded-md border shadow-2xs h-9">
              <button
                type="button"
                onClick={handleExpandAll}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all select-none cursor-pointer",
                  groupViewState === "expanded"
                    ? "bg-background text-primary font-semibold shadow-xs ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60",
                )}
              >
                <ChevronsUpDown className="h-3.5 w-3.5 text-primary" />
                <span>Expand All</span>
              </button>
              <div className="h-4 w-px bg-border/70 my-auto" />
              <button
                type="button"
                onClick={handleCollapseAll}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all select-none cursor-pointer",
                  groupViewState === "collapsed"
                    ? "bg-background text-primary font-semibold shadow-xs ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60",
                )}
              >
                <ChevronsUp className="h-3.5 w-3.5 text-primary" />
                <span>Collapse All</span>
              </button>
            </div>

            {/* Stage Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Stage:</span>
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-[155px] h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Stages</SelectItem>
                  {STAGE_PIPELINE.map((s) => (
                    <SelectItem key={s.stageType} value={s.stageType}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Status:</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[135px] h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  {MACHINE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px] text-center">#</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Machine Name</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : filteredMachines.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No machines found</TableCell></TableRow>
            ) : (
              groupedMachines.map((group) => {
                const isCollapsed = Boolean(collapsedGroups[group.key]);
                return (
                  <Fragment key={`group-${group.key}`}>
                    <TableRow
                      className="bg-muted/60 hover:bg-muted/80 cursor-pointer font-medium select-none transition-colors"
                      onClick={() => toggleGroup(group.key)}
                    >
                      <TableCell colSpan={6} className="py-2.5 px-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isCollapsed ? (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="font-semibold text-foreground text-sm">
                              {group.label}
                            </span>
                            <Badge variant="secondary" className="text-xs font-normal">
                              {group.items.length} {group.items.length === 1 ? "machine" : "machines"}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>

                    {!isCollapsed &&
                      group.items.map((m, idx) => (
                        <TableRow key={m.id}>
                          <TableCell className="text-center font-mono text-xs text-muted-foreground">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="font-mono text-sm font-semibold">{m.machineCode}</TableCell>
                          <TableCell className="font-medium">{m.name}</TableCell>
                          <TableCell>{getStageLabel(m.stageType)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={STATUS_COLORS[m.status] || ""}>
                              {m.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button variant="ghost" size="sm" onClick={() => { setDowntimeMachine(m); loadDowntime(m.id); }}>Downtime</Button>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Machine" : "New Machine"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <FormField label="Code" required error={errors.machineCode}>
              <Input className={fieldClassName("", !!errors.machineCode)} value={form.machineCode} onChange={(e) => patchForm("machineCode", e.target.value.toUpperCase())} disabled={!!editing} placeholder="e.g. SLIT-01, PRT-02" />
            </FormField>
            <FormField label="Name" required error={errors.name}>
              <Input className={fieldClassName("", !!errors.name)} value={form.name} onChange={(e) => patchForm("name", e.target.value)} placeholder="Machine description" />
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
