"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField, fieldClassName } from "@/components/ui/form-field";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { supplierSchema } from "@/lib/validations/admin-forms";
import { firstErrorMessage, validateForm } from "@/lib/validations/form-utils";

const EMPTY_SUPPLIER = { name: "", contactPerson: "", contactNumber: "", address: "" };

/** Registers a new supplier inline (e.g. while receiving its first delivery) and hands it back via onSaved. */
export function NewSupplierDialog({ open, onOpenChange, onSaved, initialName = "" }) {
  const [form, setForm] = useState(EMPTY_SUPPLIER);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_SUPPLIER, name: initialName });
      setErrors({});
    }
  }, [open, initialName]);

  const bind = (field) => ({
    value: form[field],
    onChange: (e) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    className: fieldClassName("", !!errors[field]),
  });

  async function handleSave() {
    const result = validateForm(supplierSchema, form);
    if (!result.success) {
      setErrors(result.errors);
      toast.error(firstErrorMessage(result.errors));
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post("/suppliers", form);
      toast.success(`Supplier "${data.supplier.name}" added`);
      onSaved(data.supplier);
      onOpenChange(false);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> New Supplier
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <FormField label="Supplier Name" required error={errors.name}>
            <Input {...bind("name")} placeholder="Company name" />
          </FormField>
          <FormField label="Contact Person" error={errors.contactPerson}>
            <Input {...bind("contactPerson")} placeholder="Representative name" />
          </FormField>
          <FormField label="Phone" error={errors.contactNumber}>
            <Input {...bind("contactNumber")} placeholder="Phone number" />
          </FormField>
          <FormField label="Address" error={errors.address}>
            <Input {...bind("address")} placeholder="Street, city…" />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Supplier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
