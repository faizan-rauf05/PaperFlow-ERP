"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SegmentedChoice } from "@/components/ui/segmented-choice";
import { FormField, fieldClassName } from "@/components/ui/form-field";
import { scrollToFirstError, useUnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { formatKWD } from "@/lib/currency";
import { clearFieldError, firstErrorMessage, validateForm } from "@/lib/validations/form-utils";
import {
  DRAFTABLE_ORDER_STATUSES,
  MAX_REFERENCE_FILES,
  computeOrderTotals,
  lineClicheErrors,
  salesOrderSchema,
} from "@/lib/validations/sales-order";
import {
  CLICHE_OWNERSHIP_LABELS,
  CLICHE_SOURCE_LABELS,
  clicheDetailsLabel,
  clicheSizeLabel,
  lineNeedsCliche,
} from "@/lib/order-labels";

const PAPER_TYPES = [
  { value: "VIRGIN", label: "Virgin Paper" },
  { value: "RECYCLED", label: "Recycled Paper" },
];

const PAPER_COLORS = [
  { value: "WHITE", label: "White" },
  { value: "BROWN", label: "Brown" },
];

const COLOR_COUNTS = [
  { value: "0", label: "0 (Plain — no print)" },
  { value: "1", label: "1 Color" },
  { value: "2", label: "2 Colors" },
  { value: "3", label: "3 Colors" },
  { value: "4", label: "4 Colors" },
  { value: "5", label: "5+ Colors" },
];

const CLICHE_SOURCE_OPTIONS = Object.entries(CLICHE_SOURCE_LABELS).map(([value, label]) => ({ value, label }));
const CLICHE_OWNERSHIP_OPTIONS = Object.entries(CLICHE_OWNERSHIP_LABELS).map(([value, label]) => ({ value, label }));

const PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

const STATUS_LABELS = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending Approval",
  REJECTED: "Rejected",
  APPROVED: "Approved",
  PENDING_CUSTOMER_APPROVAL: "Quote Sent",
  CUSTOMER_APPROVED: "Customer Approved",
};

/** Statuses where an edit sends an already-approved order back through approval + a new quote. */
const PAST_APPROVAL_STATUSES = ["APPROVED", "PENDING_CUSTOMER_APPROVAL", "CUSTOMER_APPROVED"];

const EMPTY_LINE = {
  widthCm: "",
  heightCm: "",
  baseCm: "",
  quantity: "",
  withHandle: true,
  paperType: "VIRGIN",
  paperColor: "WHITE",
  colorCount: "0",
  unitPrice: "",
  lineTotal: "",
  referenceFiles: [],
  clicheMode: "",
  clicheId: "",
  clicheHeightCm: "",
  clicheWidthCm: "",
  clicheColorCount: "",
  clicheSource: "PURCHASED_NEW",
  clicheOwnership: "COMPANY_OWNED",
  clicheCost: "",
  clicheNotes: "",
};

const EMPTY_FORM = {
  customerId: "",
  salesRepId: "",
  priority: "NORMAL",
  deliveryDate: "",
  notes: "",
  discount: "",
  lines: [{ ...EMPTY_LINE }],
};

const numString = (v) => (v == null || v === "" ? "" : String(Number(v)));

/**
 * A saved line's cliché -> the form's cliché fields: one this order added
 * stays editable ("Add new"), any other is a reused one ("Use existing").
 */
function clicheToFormValues(line, orderId) {
  const c = line.cliche;
  if (!c) return {};
  if (c.originOrderId !== orderId) return { clicheMode: "EXISTING", clicheId: c.id };
  return {
    clicheMode: "NEW",
    clicheId: c.id,
    clicheHeightCm: numString(c.heightCm),
    clicheWidthCm: numString(c.widthCm),
    clicheColorCount: numString(c.colorCount),
    clicheSource: c.source,
    clicheOwnership: c.ownership,
    clicheCost: numString(c.cost),
    clicheNotes: c.notes || "",
  };
}

/** An order from the API -> the form's raw string values. */
function orderToFormValues(order) {
  return {
    customerId: order.customerId || "",
    salesRepId: order.salesRepId || "",
    priority: order.priority || "NORMAL",
    deliveryDate: order.deliveryDate ? order.deliveryDate.split("T")[0] : "",
    notes: order.notes || "",
    discount: order.discount && Number(order.discount) > 0 ? numString(order.discount) : "",
    lines: (order.lines || []).map((l) => ({
      ...EMPTY_LINE,
      ...clicheToFormValues(l, order.id),
      widthCm: numString(l.widthCm),
      heightCm: numString(l.heightCm),
      baseCm: numString(l.baseCm),
      quantity: numString(l.quantity),
      withHandle: Boolean(l.withHandle),
      paperType: l.paperType || "VIRGIN",
      paperColor: l.paperColor || "WHITE",
      colorCount: String(l.colorCount ?? 0),
      unitPrice: numString(l.unitPrice),
      lineTotal: l.lineTotal != null ? Number(l.lineTotal).toFixed(2) : "",
      referenceFiles: Array.isArray(l.referenceFiles)
        ? l.referenceFiles
        : l.fileUrl
          ? [{ url: l.fileUrl, name: l.fileName || "Reference File" }]
          : [],
    })),
  };
}

/**
 * Keeps unit price and line total in step: editing quantity or unit price
 * recomputes the total; editing the total recomputes the unit price. Unit
 * price keeps 3 decimals (fils) — bag prices like 0.155 KWD are common.
 */
function withLinePriceSync(line, field) {
  const qty = parseFloat(line.quantity);
  if (!(qty > 0)) return line;
  if (field === "quantity" || field === "unitPrice") {
    const unit = parseFloat(line.unitPrice);
    return unit > 0 ? { ...line, lineTotal: (qty * unit).toFixed(2) } : line;
  }
  if (field === "lineTotal") {
    const total = parseFloat(line.lineTotal);
    return total > 0 ? { ...line, unitPrice: String(Number((total / qty).toFixed(3))) } : line;
  }
  return line;
}

function SectionHeading({ title, description, action }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function SelectField({ label, required, className, options, placeholder, value, onChange, error }) {
  return (
    <FormField label={label} required={required} error={error} className={className}>
      <Select value={value ? String(value) : ""} onValueChange={onChange}>
        <SelectTrigger className={cn("w-full truncate", error && "border-destructive")}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={String(o.value)}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

function InputField({ label, required, className, hint, value, onChange, error, ...inputProps }) {
  return (
    <FormField label={label} required={required} error={error} hint={hint} className={className}>
      <Input
        className={fieldClassName("", !!error)}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        {...inputProps}
      />
    </FormField>
  );
}

/**
 * A printed line's cliché: reuse one on file for the customer, or add a new
 * one — purchased for this order (billed to the customer at cost), supplied
 * by the customer, or already owned but not yet on file.
 */
function LineClicheFields({ line, bindLine, clicheOptions, clichesLoading, hasCustomer }) {
  const mode = bindLine("clicheMode");
  const picked = bindLine("clicheId");
  const source = line.clicheSource;
  return (
    <div className="space-y-3 rounded-md border border-dashed p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            Cliché (printing plate) <span className="text-destructive">*</span>
          </p>
          <p className="text-xs text-muted-foreground">
            A newly purchased cliché is billed to the customer at cost and shown on the quote.
          </p>
        </div>
        <SegmentedChoice
          options={[
            { value: "EXISTING", label: "Use existing" },
            { value: "NEW", label: "Add new" },
          ]}
          value={line.clicheMode}
          onChange={mode.onChange}
        />
      </div>
      {mode.error && (
        <p className="text-xs text-destructive" role="alert">
          {mode.error}
        </p>
      )}

      {line.clicheMode === "EXISTING" && (
        <FormField label="Cliché" required error={picked.error}>
          <SearchableSelect
            value={line.clicheId}
            onValueChange={picked.onChange}
            loading={clichesLoading}
            disabled={!hasCustomer}
            options={clicheOptions}
            placeholder={hasCustomer ? "Select a cliché..." : "Select a customer first"}
            searchPlaceholder="Search by size, colors or code..."
            emptyText="No clichés on file for this customer — add a new one."
            error={!!picked.error}
            className="h-9"
          />
        </FormField>
      )}

      {line.clicheMode === "NEW" && (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <InputField label="Height (cm)" required type="number" min="0" step="0.1" {...bindLine("clicheHeightCm")} />
            <InputField label="Width (cm)" required type="number" min="0" step="0.1" {...bindLine("clicheWidthCm")} />
            <InputField
              label="Colors"
              type="number"
              min="1"
              step="1"
              placeholder={line.colorCount}
              hint="Blank = the line's print colors."
              {...bindLine("clicheColorCount")}
            />
            <SelectField label="Source" required options={CLICHE_SOURCE_OPTIONS} {...bindLine("clicheSource")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {source === "CUSTOMER_SUPPLIED" ? (
              <FormField label="Ownership">
                <Input value={CLICHE_OWNERSHIP_LABELS.CUSTOMER_OWNED} readOnly disabled />
              </FormField>
            ) : (
              <SelectField label="Ownership" options={CLICHE_OWNERSHIP_OPTIONS} {...bindLine("clicheOwnership")} />
            )}
            {source === "PURCHASED_NEW" && (
              <InputField
                label="Cost (KWD)"
                required
                type="number"
                min="0"
                step="0.001"
                placeholder="0.000"
                hint="Billed to the customer at cost."
                {...bindLine("clicheCost")}
              />
            )}
            <InputField
              label="Notes"
              placeholder="Optional"
              className={source === "PURCHASED_NEW" ? undefined : "sm:col-span-2"}
              {...bindLine("clicheNotes")}
            />
          </div>
        </>
      )}
    </div>
  );
}

function LineItemFields({
  index,
  line,
  bindLine,
  onRemove,
  canRemove,
  onUpload,
  uploading,
  onRemoveFile,
  clicheOptions,
  clichesLoading,
  hasCustomer,
}) {
  const files = line.referenceFiles || [];
  return (
    <div className="space-y-4 rounded-md border bg-background/40 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Line {index + 1}</span>
        {canRemove && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <InputField label="Height (cm)" required type="number" min="1" step="0.1" placeholder="e.g. 40" {...bindLine("heightCm")} />
        <InputField label="Width (cm)" required type="number" min="1" step="0.1" placeholder="e.g. 30" {...bindLine("widthCm")} />
        <InputField label="Base (cm)" required type="number" min="1" step="0.1" placeholder="e.g. 12" {...bindLine("baseCm")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <InputField label="Quantity (bags)" required type="number" min="1" step="1" placeholder="e.g. 50000" {...bindLine("quantity")} />
        <SelectField label="Paper Type" required options={PAPER_TYPES} {...bindLine("paperType")} />
        <SelectField label="Paper Color" required options={PAPER_COLORS} {...bindLine("paperColor")} />
        <SelectField label="Print Colors" options={COLOR_COUNTS} {...bindLine("colorCount")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Handle">
          <SegmentedChoice
            options={[
              { value: "WITH", label: "With handle" },
              { value: "WITHOUT", label: "Without" },
            ]}
            value={line.withHandle ? "WITH" : "WITHOUT"}
            onChange={(v) => bindLine("withHandle").onChange(v === "WITH")}
          />
        </FormField>
        <InputField label="Unit Price (KWD / bag)" type="number" min="0" step="0.001" placeholder="0.000" {...bindLine("unitPrice")} />
        <InputField label="Line Total (KWD)" type="number" min="0" step="0.01" placeholder="0.00" {...bindLine("lineTotal")} />
      </div>

      {lineNeedsCliche(line) && (
        <LineClicheFields
          line={line}
          bindLine={bindLine}
          clicheOptions={clicheOptions}
          clichesLoading={clichesLoading}
          hasCustomer={hasCustomer}
        />
      )}

      <FormField
        label="Reference / Design Files"
        hint={`Images or PDFs, up to ${MAX_REFERENCE_FILES} per line.`}
        error={bindLine("referenceFiles").error}
      >
        <div className="flex flex-wrap items-center gap-2">
          {files.map((f, fileIdx) => (
            <span key={`${f.url}-${fileIdx}`} className="flex items-center gap-1 rounded border bg-muted px-2 py-1 text-xs">
              <a href={f.url} target="_blank" rel="noreferrer" className="max-w-40 truncate text-primary hover:underline">
                {f.name || `File ${fileIdx + 1}`}
              </a>
              <button
                type="button"
                onClick={() => onRemoveFile(fileIdx)}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${f.name || "file"}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {files.length < MAX_REFERENCE_FILES && (
            <Button type="button" variant="secondary" size="sm" className="border" asChild disabled={uploading}>
              <label className="cursor-pointer">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploading ? "Uploading…" : "Attach file"}
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    onUpload(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </Button>
          )}
        </div>
      </FormField>
    </div>
  );
}

/**
 * Create/edit form for an order proposal, shared by the Sales, Admin and
 * Manager dashboards. `order` is the API order when editing, else null.
 * `role` decides the sales-rep field: Sales are always the rep on their own
 * proposals (the API enforces it); Admin/Manager may pick one or leave it empty.
 */
export function OrderForm({ order = null, role, listHref }) {
  const isEdit = Boolean(order);
  const isSales = role === "SALES";
  const status = order?.status;

  const [initialForm] = useState(() => (isEdit ? orderToFormValues(order) : EMPTY_FORM));
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(null); // null | "DRAFT" | "PENDING_APPROVAL"
  const [uploadingLine, setUploadingLine] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [salesReps, setSalesReps] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [repsLoading, setRepsLoading] = useState(!isSales);
  const [cliches, setCliches] = useState([]);
  const [clichesLoading, setClichesLoading] = useState(false);
  const formRef = useRef(null);

  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initialForm), [form, initialForm]);
  const { leaveTo, requestLeave, dialog: leaveDialog } = useUnsavedChangesGuard(isDirty, {
    noun: "this order",
  });

  useEffect(() => {
    api
      .get("/customers")
      .then(({ data }) => setCustomers(data.customers || []))
      .catch(() => setCustomers([]))
      .finally(() => setCustomersLoading(false));
    if (!isSales) {
      api
        .get("/users/sales-reps")
        .then(({ data }) => setSalesReps(data.salesReps || []))
        .catch(() => setSalesReps([]))
        .finally(() => setRepsLoading(false));
    }
  }, [isSales]);

  // The customer's clichés (plus ones not tied to any customer) for reuse
  useEffect(() => {
    if (!form.customerId) {
      setCliches([]);
      return;
    }
    let cancelled = false;
    setClichesLoading(true);
    api
      .get("/cliches", { params: { customerId: form.customerId, includeShared: 1, activeOnly: 1, take: 200 } })
      .then(({ data }) => !cancelled && setCliches(data.cliches || []))
      .catch(() => !cancelled && setCliches([]))
      .finally(() => !cancelled && setClichesLoading(false));
    return () => {
      cancelled = true;
    };
  }, [form.customerId]);

  // This order's own new clichés are edited as "Add new", so they aren't offered for reuse here.
  const clicheOptions = cliches
    .filter((c) => !order || c.originOrderId !== order.id)
    .map((c) => ({ value: c.id, label: clicheSizeLabel(c), description: clicheDetailsLabel(c) }));

  const totals = computeOrderTotals(form.lines, form.discount);

  function patchForm(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      // A reused cliché belongs to the customer it was picked for
      ...(field === "customerId" && value !== prev.customerId
        ? { lines: prev.lines.map((l) => (l.clicheMode === "EXISTING" ? { ...l, clicheId: "" } : l)) }
        : {}),
    }));
    setErrors((prev) => clearFieldError(prev, field));
  }

  function bind(field) {
    return { value: form[field], onChange: (value) => patchForm(field, value), error: errors[field] };
  }

  function patchLine(index, field, value) {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l, i) => (i === index ? withLinePriceSync({ ...l, [field]: value }, field) : l)),
    }));
    setErrors((prev) => {
      const next = clearFieldError(prev, `lines.${index}.${field}`);
      if (field === "unitPrice" || field === "lineTotal") {
        return clearFieldError(clearFieldError(next, `lines.${index}.unitPrice`), `lines.${index}.lineTotal`);
      }
      // These change which of the line's cliché fields are required
      if (field === "clicheMode" || field === "clicheSource" || field === "colorCount") {
        return Object.fromEntries(Object.entries(next).filter(([k]) => !k.startsWith(`lines.${index}.cliche`)));
      }
      return next;
    });
  }

  function bindLine(index) {
    return (field) => ({
      value: form.lines[index][field],
      onChange: (value) => patchLine(index, field, value),
      error: errors[`lines.${index}.${field}`],
    });
  }

  function addLine() {
    setForm((prev) => ({ ...prev, lines: [...prev.lines, { ...EMPTY_LINE }] }));
    setErrors((prev) => clearFieldError(prev, "lines"));
  }

  function removeLine(index) {
    // Line errors are keyed by position, so they'd point at the wrong line after a removal.
    setForm((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith("lines."))));
  }

  async function uploadFiles(index, fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    const current = form.lines[index].referenceFiles || [];
    if (current.length + files.length > MAX_REFERENCE_FILES) {
      toast.error(`At most ${MAX_REFERENCE_FILES} reference files per line`);
      return;
    }
    setUploadingLine(index);
    try {
      const uploaded = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const { data } = await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
        uploaded.push({ url: data.photoUrl, name: file.name || "Design Reference" });
      }
      patchLine(index, "referenceFiles", [...current, ...uploaded]);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setUploadingLine(null);
    }
  }

  async function handleSave(targetStatus) {
    const payload = { ...form, status: targetStatus };
    const result = validateForm(salesOrderSchema, payload);
    if (!result.success) {
      // Zod skips the whole-order rules (clichés, discount) while any field
      // is invalid; check them here too so every problem shows in one pass.
      result.errors = { ...lineClicheErrors(form.lines, targetStatus), ...result.errors };
      if (!result.errors.discount && totals.discount > 0 && totals.discount > totals.subtotal) {
        result.errors.discount = "Discount can't be more than the subtotal";
      }
      setErrors(result.errors);
      toast.error(firstErrorMessage(result.errors));
      scrollToFirstError(formRef.current);
      return;
    }

    // Send the raw form: the API validates it with the same schema.
    setSaving(targetStatus);
    try {
      if (isEdit) {
        await api.put(`/orders/${order.id}`, payload);
      } else {
        await api.post("/orders", payload);
      }
      toast.success(
        targetStatus === "DRAFT"
          ? "Draft saved"
          : isEdit && status === "PENDING_APPROVAL"
            ? "Changes saved — still awaiting approval"
            : "Proposal submitted for approval",
      );
      leaveTo(listHref);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSaving(null);
    }
  }

  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: c.name,
    description: c.companyName || c.email || undefined,
  }));
  const repOptions = salesReps.map((r) => ({ value: r.id, label: r.name, description: r.email }));

  const canSaveDraft = !isEdit || DRAFTABLE_ORDER_STATUSES.includes(status);
  const isPastApproval = PAST_APPROVAL_STATUSES.includes(status);
  // Re-saving a pending proposal with no changes would be a no-op
  const nothingToSave = isEdit && status === "PENDING_APPROVAL" && !isDirty;
  const submitLabel = isPastApproval
    ? "Re-submit for Approval"
    : isEdit && status === "PENDING_APPROVAL"
      ? "Save Changes"
      : "Submit for Approval";

  return (
    <div ref={formRef} className="mx-auto max-w-4xl space-y-4">
      <div className="space-y-3">
        <Button variant="secondary" size="sm" asChild className="border">
          <Link href={listHref}>
            <ArrowLeft className="h-4 w-4" /> Back to Orders
          </Link>
        </Button>
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
            {isEdit ? `Edit Order ${order.orderNo}` : "New Order Proposal"}
            {isEdit && (
              <Badge variant="outline" className="text-xs font-medium">
                {STATUS_LABELS[status] || status}
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            The proposal goes to an admin or manager, who reviews the cost and approves or revises the price.
          </p>
        </div>
      </div>

      {isPastApproval && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          This order has already been approved. Saving changes sends it back for approval, so a new quote
          will need customer confirmation.
        </div>
      )}

      <div className="divide-y rounded-lg border bg-card">
        <section className="space-y-4 px-4 py-5 sm:px-6">
          <SectionHeading title="Customer & Order" />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Customer" required error={errors.customerId}>
              <SearchableSelect
                value={form.customerId}
                onValueChange={(v) => patchForm("customerId", v)}
                loading={customersLoading}
                options={customerOptions}
                placeholder="Select customer..."
                searchPlaceholder="Search customer..."
                emptyText="No customers found."
                error={!!errors.customerId}
                className="h-9"
              />
            </FormField>
            {isSales ? (
              <FormField label="Sales Rep" hint="Proposals you create are assigned to you.">
                <Input value={order?.salesRepUser?.name || order?.salesRep || "You"} readOnly disabled />
              </FormField>
            ) : (
              <FormField label="Sales Rep" error={errors.salesRepId}>
                <SearchableSelect
                  value={form.salesRepId}
                  onValueChange={(v) => patchForm("salesRepId", v)}
                  loading={repsLoading}
                  options={repOptions}
                  placeholder="No sales rep"
                  searchPlaceholder="Search sales rep..."
                  emptyText="No sales reps found."
                  className="h-9"
                />
              </FormField>
            )}
            <SelectField label="Priority" options={PRIORITIES} {...bind("priority")} />
            <InputField label="Expected Delivery Date" type="date" {...bind("deliveryDate")} />
            <FormField label="Notes / Customer Instructions" error={errors.notes} className="sm:col-span-2">
              <textarea
                rows={2}
                maxLength={1000}
                className={fieldClassName(
                  "w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs dark:bg-input/30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  !!errors.notes,
                )}
                value={form.notes}
                onChange={(e) => patchForm("notes", e.target.value)}
                placeholder="e.g. special packing requirement"
              />
            </FormField>
          </div>
        </section>

        <section className="space-y-4 px-4 py-5 sm:px-6">
          <SectionHeading
            title="Line Items"
            description="One line per bag size / specification."
            action={
              <Button type="button" variant="secondary" size="sm" className="border" onClick={addLine}>
                <Plus className="h-3.5 w-3.5" /> Add Line
              </Button>
            }
          />
          {errors.lines && (
            <p className="text-xs text-destructive" role="alert">
              {errors.lines}
            </p>
          )}
          <div className="space-y-3">
            {form.lines.map((line, i) => (
              <LineItemFields
                key={i}
                index={i}
                line={line}
                bindLine={bindLine(i)}
                canRemove={form.lines.length > 1}
                onRemove={() => removeLine(i)}
                uploading={uploadingLine === i}
                onUpload={(files) => uploadFiles(i, files)}
                onRemoveFile={(fileIdx) =>
                  patchLine(i, "referenceFiles", line.referenceFiles.filter((_, f) => f !== fileIdx))
                }
                clicheOptions={clicheOptions}
                clichesLoading={clichesLoading}
                hasCustomer={!!form.customerId}
              />
            ))}
          </div>
        </section>

        <section className="space-y-4 px-4 py-5 sm:px-6">
          <SectionHeading
            title="Pricing"
            description="The proposed price. The approver may revise it; the customer confirms the final price on the quote."
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              label="Subtotal"
              hint={totals.clicheCharges > 0 ? `Includes ${formatKWD(totals.clicheCharges)} for purchased clichés.` : undefined}
            >
              <p className="flex h-9 items-center font-mono text-sm">{formatKWD(totals.subtotal)}</p>
            </FormField>
            <InputField label="Discount (KWD)" type="number" min="0" step="0.01" placeholder="0.00" {...bind("discount")} />
            <FormField label="Proposed Total">
              <p className="flex h-9 items-center font-mono text-lg font-semibold text-primary">
                {formatKWD(totals.total)}
              </p>
            </FormField>
          </div>
        </section>
      </div>

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
        <p className="text-xs text-muted-foreground">
          <span className="text-destructive">*</span> Required
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => requestLeave(listHref)} disabled={!!saving}>
            Cancel
          </Button>
          {canSaveDraft && (
            <Button variant="outline" onClick={() => handleSave("DRAFT")} disabled={!!saving}>
              {saving === "DRAFT" && <Loader2 className="h-4 w-4 animate-spin" />}
              Save as Draft
            </Button>
          )}
          <Button
            onClick={() => handleSave("PENDING_APPROVAL")}
            disabled={!!saving || nothingToSave}
            title={nothingToSave ? "No changes — this proposal is already awaiting approval" : undefined}
          >
            {saving === "PENDING_APPROVAL" && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </div>

      {leaveDialog}
    </div>
  );
}
