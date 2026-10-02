"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, fieldClassName } from "@/components/ui/form-field";
import { SegmentedChoice } from "@/components/ui/segmented-choice";
import { MATERIAL_TYPE_CONFIG, UNIT_LABELS, formatQuantity, packEquivalent, packNoun } from "@/lib/material-catalog";

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const round = (n) => Math.round(n * 10000) / 10000;
const UNIT_WORD = { KG: "kg", METER: "meter", PCS: "piece", ROLL: "roll", CARTON: "carton", BAG: "bag" };

/**
 * A stock quantity entered either in the material's unit (kg, m…) or — for
 * packed materials with a known pack size (the latest delivery's, else the
 * type default) — as a number of packs. One input at a time: pack count or
 * total quantity; a different pack size means entering the total instead.
 * `value`/`onChange` are always in the material's unit (a string, "" when blank).
 * `available` (optional) enables an "All" shortcut.
 */
export function QuantityInput({ material, value, onChange, error, label = "Quantity", available = null }) {
  const pack = MATERIAL_TYPE_CONFIG[material?.materialType]?.pack || null;
  const unit = material?.unit;
  const unitLabel = UNIT_LABELS[unit] || unit;
  const packSize = pack ? Number(material?.lastPackSize) || pack.defaultSize || 0 : 0;
  const packable = packSize > 0;
  const wholePacks = (q) => Number.isInteger(round(Number(q) / packSize));

  // Start in packs when the initial quantity is a whole number of packs (or blank).
  const [mode, setMode] = useState(() => (packable && (!value || wholePacks(value)) ? "PACK" : "UNIT"));
  const [packCount, setPackCount] = useState(() =>
    packable && value && wholePacks(value) ? String(round(Number(value) / packSize)) : "",
  );

  const setPacks = (count) => {
    setPackCount(count);
    const total = Number(count) * packSize;
    onChange(count !== "" && total > 0 ? String(round(total)) : "");
  };

  function switchMode(next) {
    setMode(next);
    // Keep the same quantity if it's a whole number of packs; otherwise start the count fresh.
    if (next === "PACK") setPacks(value && wholePacks(value) ? String(round(Number(value) / packSize)) : "");
  }

  function useAll() {
    if (!(available > 0)) return;
    if (mode === "PACK" && wholePacks(available)) {
      setPacks(String(round(available / packSize)));
    } else {
      setMode("UNIT");
      onChange(String(round(available)));
    }
  }

  const allButton = available > 0 && (
    <Button type="button" variant="ghost" size="sm" className="h-9 shrink-0" onClick={useAll}>
      All
    </Button>
  );

  return (
    <div className="space-y-3">
      {packable && (
        <SegmentedChoice
          options={[
            { value: "PACK", label: `By ${pack.name}` },
            { value: "UNIT", label: `By ${UNIT_WORD[unit] || "unit"}` },
          ]}
          value={mode}
          onChange={switchMode}
        />
      )}

      {mode === "PACK" ? (
        <FormField
          label={`${capitalize(packNoun(pack.name, 2))} (${formatQuantity(packSize, unit)} each)`}
          required
          error={error}
          hint={
            Number(value) > 0
              ? `Total: ${formatQuantity(value, unit)}`
              : `Different ${pack.name} size? Switch to “By ${UNIT_WORD[unit] || "unit"}” and enter the total.`
          }
        >
          <div className="flex gap-1">
            <Input
              type="number"
              min="1"
              step="1"
              value={packCount}
              onChange={(e) => setPacks(e.target.value)}
              className={fieldClassName("", !!error)}
              placeholder="e.g. 5"
            />
            {allButton}
          </div>
        </FormField>
      ) : (
        <FormField label={`${label} (${unitLabel})`} required error={error}>
          <div className="flex gap-1">
            <Input
              type="number"
              min="0"
              step="any"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className={fieldClassName("", !!error)}
            />
            {allButton}
          </div>
          {packable && Number(value) > 0 && (
            <p className="text-xs text-muted-foreground">{packEquivalent(value, packSize, pack.name, unit)}</p>
          )}
        </FormField>
      )}
      {available != null && (
        <p className="text-xs text-muted-foreground">
          Available: {formatQuantity(available, unit)}
          {packable && available > 0 ? ` (${packEquivalent(available, packSize, pack.name, unit).replace(/^= /, "")})` : ""}
        </p>
      )}
    </div>
  );
}
