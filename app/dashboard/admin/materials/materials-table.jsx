"use client";

import { Fragment, memo } from "react";
import {
  Pencil,
  Trash2,
  Loader2,
  ArrowDownAZ,
  ArrowUpZA,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMaterialSummary } from "@/lib/material-code";
import { MATERIAL_TYPE_LABELS, COST_PACK_UNIT_LABEL_BY_TYPE } from "@/lib/material-constants";
import { cn, formatDateTime } from "@/lib/utils";

const COLUMN_COUNT = 13;

function SortableHead({ label, column, sortBy, sortDir, onSort, className }) {
  const active = sortBy === column;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex items-center gap-1 font-medium hover:text-foreground transition-colors",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        {active &&
          (sortDir === "asc" ? (
            <ArrowDownAZ className="h-3.5 w-3.5" />
          ) : (
            <ArrowUpZA className="h-3.5 w-3.5" />
          ))}
      </button>
    </TableHead>
  );
}

/** Materials table's Cost Price cell — always shown in KWD, with a hover badge when it was entered in USD. */
function CostPriceCell({ material }) {
  if (material.costPricePerUnit == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  const unitLabel = (material.unit || "").toLowerCase();
  const isUsd = material.costPriceCurrency === "USD";
  const isPack = material.costPriceEntryBasis === "PER_PACK";
  const packLabel = COST_PACK_UNIT_LABEL_BY_TYPE[material.materialType] || "pack";

  let tooltip;
  if (isUsd) {
    const usdAmount = Number(material.costPriceOriginalAmount).toFixed(2);
    const fxRate = Number(material.costPriceExchangeRate).toFixed(5);
    const rateDate = material.costPriceRateDate
      ? new Date(material.costPriceRateDate).toLocaleDateString()
      : "";
    tooltip = `Entered as $${usdAmount}${isPack ? ` per ${packLabel.toLowerCase()}` : ` per ${unitLabel}`} @ 1 USD = ${fxRate} KWD (${rateDate})`;
  } else if (isPack) {
    tooltip = `Entered as ${Number(material.costPriceOriginalAmount).toFixed(2)} KWD per ${packLabel.toLowerCase()}`;
  }

  return (
    <div className="flex items-center gap-1.5" title={tooltip}>
      <span>
        {Number(material.costPricePerUnit).toFixed(2)} KWD/{unitLabel}
      </span>
      {isUsd && (
        <Badge variant="secondary" className="text-[10px] px-1 py-0 leading-4">
          USD
        </Badge>
      )}
    </div>
  );
}

function MaterialRow({ material: m, idx, selected, onToggleSelected, onImagePreview, onEdit, onDeleteRequest }) {
  return (
    <TableRow data-state={selected ? "selected" : undefined}>
      <TableCell className="text-center">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelected(m.id)}
          aria-label={`Select ${m.name}`}
        />
      </TableCell>
      <TableCell className="text-center font-mono text-xs text-muted-foreground">
        {idx + 1}
      </TableCell>
      <TableCell className="text-center">
        {m.imageUrl ? (
          <button
            type="button"
            onClick={() => onImagePreview(m.imageUrl)}
            title="Click to open zoomable label image"
            className="inline-block relative group"
          >
            <img
              src={m.imageUrl}
              alt="Label"
              className="h-8 w-8 object-cover rounded border mx-auto group-hover:opacity-80 transition-opacity"
            />
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="font-medium">{m.name}</TableCell>
      <TableCell>{MATERIAL_TYPE_LABELS[m.materialType] ?? m.materialType}</TableCell>
      <TableCell>{m.supplier || "—"}</TableCell>
      <TableCell className="font-mono text-sm">{m.barCode || m.batchNo || "—"}</TableCell>
      <TableCell className="font-mono text-xs whitespace-nowrap">
        {m.initialStock !== undefined
          ? `${m.initialStock.toLocaleString()} ${m.unit || ""}`
          : "—"}
      </TableCell>
      <TableCell className="font-mono text-xs whitespace-nowrap">
        <span
          className={cn(
            "font-semibold px-2 py-0.5 rounded text-xs inline-block",
            (m.availableStock ?? 0) <= 0
              ? "bg-destructive/10 text-destructive"
              : m.isLowStock
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
          )}
        >
          {(m.availableStock ?? 0).toLocaleString()} {m.unit || ""}
        </span>
      </TableCell>
      <TableCell className="font-mono text-xs whitespace-nowrap">
        <CostPriceCell material={m} />
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">{getMaterialSummary(m)}</TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {m.createdAt ? formatDateTime(m.createdAt) : "—"}
      </TableCell>
      <TableCell className="text-right space-x-1">
        <Button variant="ghost" size="icon" onClick={() => onEdit(m)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDeleteRequest(m.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

/**
 * Pure/presentational — wrapped in memo() so typing in the Add/Edit Material
 * dialog (form state lives in the parent) doesn't force this table to
 * rebuild and reconcile every row on every keystroke. Only re-renders when
 * one of these props actually changes reference (data, sort/group/selection
 * state, or the callbacks below).
 */
export const MaterialsTable = memo(function MaterialsTable({
  loading,
  sortedMaterials,
  groupedMaterials,
  groupBy,
  collapsedGroups,
  onToggleGroup,
  sortBy,
  sortDir,
  onSort,
  selectedIds,
  allVisibleSelected,
  someVisibleSelected,
  onToggleSelectAll,
  onToggleSelected,
  onEdit,
  onDeleteRequest,
  onImagePreview,
}) {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[36px] text-center">
              <Checkbox
                checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                onCheckedChange={onToggleSelectAll}
                aria-label="Select all materials"
              />
            </TableHead>
            <TableHead className="w-[50px] text-center">#</TableHead>
            <TableHead className="text-center">Label</TableHead>
            <SortableHead label="Name" column="name" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortableHead
              label="Type"
              column="materialType"
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortableHead
              label="Supplier"
              column="supplier"
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortableHead
              label="Barcode / Batch"
              column="identifier"
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={onSort}
            />
            <TableHead>Initial Stock</TableHead>
            <TableHead>Available Stock</TableHead>
            <TableHead>Cost Price</TableHead>
            <TableHead>Details</TableHead>
            <SortableHead
              label="Created At"
              column="createdAt"
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={onSort}
            />
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="text-center py-8">
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              </TableCell>
            </TableRow>
          ) : sortedMaterials.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="text-center py-8 text-muted-foreground">
                No materials found
              </TableCell>
            </TableRow>
          ) : groupBy !== "none" && groupedMaterials ? (
            groupedMaterials.map((group) => {
              const isCollapsed = Boolean(collapsedGroups[group.key]);
              return (
                <Fragment key={`group-block-${group.key}`}>
                  <TableRow
                    className="bg-muted/60 hover:bg-muted/80 cursor-pointer font-medium select-none transition-colors"
                    onClick={() => onToggleGroup(group.key)}
                  >
                    <TableCell colSpan={COLUMN_COUNT} className="py-2.5 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="font-semibold text-foreground text-sm">{group.label}</span>
                          <Badge variant="secondary" className="text-xs font-normal">
                            {group.items.length} {group.items.length === 1 ? "item" : "items"}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                  {!isCollapsed &&
                    group.items.map((m, idx) => (
                      <MaterialRow
                        key={m.id}
                        material={m}
                        idx={idx}
                        selected={selectedIds.has(m.id)}
                        onToggleSelected={onToggleSelected}
                        onImagePreview={onImagePreview}
                        onEdit={onEdit}
                        onDeleteRequest={onDeleteRequest}
                      />
                    ))}
                </Fragment>
              );
            })
          ) : (
            sortedMaterials.map((m, idx) => (
              <MaterialRow
                key={m.id}
                material={m}
                idx={idx}
                selected={selectedIds.has(m.id)}
                onToggleSelected={onToggleSelected}
                onImagePreview={onImagePreview}
                onEdit={onEdit}
                onDeleteRequest={onDeleteRequest}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
});
