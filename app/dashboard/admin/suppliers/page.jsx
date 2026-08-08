"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Search, X, ChevronLeft, ChevronRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FormField, fieldClassName } from "@/components/ui/form-field";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { supplierSchema } from "@/lib/validations/admin-forms";
import { validateForm, clearFieldError, firstErrorMessage } from "@/lib/validations/form-utils";

const emptyForm = {
  name: "",
  companyName: "",
  contactPerson: "",
  contactNumber: "",
  email: "",
  address: "",
  notes: "",
  isActive: true,
};
const PAGE_SIZE = 10;

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/suppliers");
      setSuppliers(data.suppliers || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredSuppliers = useMemo(() => {
    let list = suppliers;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((s) => {
        const name = (s.name || "").toLowerCase();
        const companyName = (s.companyName || "").toLowerCase();
        const contactPerson = (s.contactPerson || "").toLowerCase();
        const contactNumber = (s.contactNumber || "").toLowerCase();
        const email = (s.email || "").toLowerCase();
        const address = (s.address || "").toLowerCase();
        return (
          name.includes(q) ||
          companyName.includes(q) ||
          contactPerson.includes(q) ||
          contactNumber.includes(q) ||
          email.includes(q) ||
          address.includes(q)
        );
      });
    }
    return list;
  }, [suppliers, searchQuery]);

  const totalPages = Math.ceil(filteredSuppliers.length / PAGE_SIZE) || 1;
  const paginatedSuppliers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredSuppliers.slice(start, start + PAGE_SIZE);
  }, [filteredSuppliers, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

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

  function openEdit(s) {
    setEditing(s);
    setForm({
      name: s.name ?? "",
      companyName: s.companyName ?? "",
      contactPerson: s.contactPerson ?? "",
      contactNumber: s.contactNumber ?? "",
      email: s.email ?? "",
      address: s.address ?? "",
      notes: s.notes ?? "",
      isActive: s.isActive ?? true,
    });
    setErrors({});
    setDialogOpen(true);
  }

  async function handleSave() {
    const result = validateForm(supplierSchema, form);
    if (!result.success) {
      setErrors(result.errors);
      toast.error(firstErrorMessage(result.errors));
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/suppliers/${editing.id}`, result.data);
        toast.success("Supplier updated");
      } else {
        await api.post("/suppliers", result.data);
        toast.success("Supplier created");
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await api.delete(`/suppliers/${deleteId}`);
      toast.success("Supplier deleted");
      setDeleteId(null);
      load();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" /> Suppliers
          </h1>
          <p className="text-muted-foreground">Manage raw material suppliers directory and contact details</p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />Add Supplier
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by supplier name, company, phone, email..."
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
        <div className="text-xs text-muted-foreground font-mono">
          Total Suppliers: <strong>{filteredSuppliers.length}</strong>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px] text-center">#</TableHead>
              <TableHead>Supplier Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Address</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : paginatedSuppliers.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No suppliers found</TableCell></TableRow>
            ) : paginatedSuppliers.map((s, idx) => (
              <TableRow key={s.id}>
                <TableCell className="text-center font-mono text-xs text-muted-foreground">
                  {(currentPage - 1) * PAGE_SIZE + idx + 1}
                </TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.companyName || "—"}</TableCell>
                <TableCell>{s.contactPerson || "—"}</TableCell>
                <TableCell>{s.contactNumber || "—"}</TableCell>
                <TableCell>{s.email || "—"}</TableCell>
                <TableCell className="max-w-[200px] truncate">{s.address || "—"}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteId(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 text-xs">
          <span className="text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Supplier" : "New Supplier"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <FormField label="Supplier Name" required error={errors.name}>
              <Input className={fieldClassName("", !!errors.name)} value={form.name} onChange={(e) => patchForm("name", e.target.value)} placeholder="Main supplier name" />
            </FormField>
            <FormField label="Company Name" error={errors.companyName}>
              <Input className={fieldClassName("", !!errors.companyName)} value={form.companyName} onChange={(e) => patchForm("companyName", e.target.value)} placeholder="Business / Organization" />
            </FormField>
            <FormField label="Contact Person" error={errors.contactPerson}>
              <Input className={fieldClassName("", !!errors.contactPerson)} value={form.contactPerson} onChange={(e) => patchForm("contactPerson", e.target.value)} placeholder="Primary representative name" />
            </FormField>
            <FormField label="Phone / Contact Number" error={errors.contactNumber}>
              <Input className={fieldClassName("", !!errors.contactNumber)} value={form.contactNumber} onChange={(e) => patchForm("contactNumber", e.target.value)} placeholder="+123..." />
            </FormField>
            <FormField label="Email" error={errors.email}>
              <Input className={fieldClassName("", !!errors.email)} value={form.email} onChange={(e) => patchForm("email", e.target.value)} placeholder="supplier@domain.com" />
            </FormField>
            <FormField label="Address" error={errors.address}>
              <textarea
                rows={3}
                className={fieldClassName("w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y", !!errors.address)}
                value={form.address}
                onChange={(e) => patchForm("address", e.target.value)}
                placeholder="Office / Warehouse full address..."
              />
            </FormField>
            <FormField label="Notes" error={errors.notes}>
              <Input className={fieldClassName("", !!errors.notes)} value={form.notes} onChange={(e) => patchForm("notes", e.target.value)} placeholder="Remarks / payment terms..." />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete supplier?</AlertDialogTitle>
            <AlertDialogDescription>Suppliers linked to existing raw materials cannot be deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
