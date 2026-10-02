/** Formats an amount as KWD, matching the convention already used for material cost price. */
export function formatKWD(amount) {
  return `${Number(amount || 0).toFixed(2)} KWD`;
}
