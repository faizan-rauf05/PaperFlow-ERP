/**
 * Display labels for order lines and clichés. Sizes always read Height ×
 * Width (× Base), the order the customer and the sales team use.
 */

const num = (v) => (v == null || v === "" ? null : Number(v));

/** Bag size "40 × 30 × 12 cm". */
export function bagSizeLabel(line) {
  const parts = [line?.heightCm, line?.widthCm, line?.baseCm].map(num).filter((v) => v != null);
  return parts.length ? `${parts.join(" × ")} cm` : "—";
}

/** Cliché size "24 × 36 cm" (Height × Width), with "?" for a missing side. */
export function clicheSizeLabel(cliche) {
  const side = (v) => num(v) ?? "?";
  return `${side(cliche?.heightCm)} × ${side(cliche?.widthCm)} cm`;
}

export const CLICHE_SOURCE_LABELS = {
  PURCHASED_NEW: "Purchased new",
  CUSTOMER_SUPPLIED: "Customer supplied",
  REUSED_EXISTING: "Already owned",
};

export const CLICHE_OWNERSHIP_LABELS = {
  COMPANY_OWNED: "Company-owned",
  CUSTOMER_OWNED: "Customer-owned",
};

/** "2 colors · Customer-owned · Purchased new · CLC-AB12" — the line under a cliché's size. */
export function clicheDetailsLabel(cliche) {
  return [
    cliche?.colorCount != null ? `${cliche.colorCount} color${cliche.colorCount === 1 ? "" : "s"}` : null,
    CLICHE_OWNERSHIP_LABELS[cliche?.ownership],
    CLICHE_SOURCE_LABELS[cliche?.source],
    cliche?.code,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Only printed lines use a cliché (printing plate); plain bags don't. */
export function lineNeedsCliche(line) {
  return Number(line?.colorCount || 0) > 0;
}
