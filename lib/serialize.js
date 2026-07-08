/** Convert Prisma Decimal fields to numbers for JSON responses. */
export function serializeDecimal(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === "object" && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  return value;
}

export function serializeModel(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(serializeModel);
  if (typeof obj !== "object") return obj;
  if (obj instanceof Date) return obj.toISOString();

  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v instanceof Date) out[k] = v.toISOString();
    else if (typeof v === "object" && v !== null && typeof v.toNumber === "function") {
      out[k] = v.toNumber();
    } else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      out[k] = serializeModel(v);
    } else if (Array.isArray(v)) {
      out[k] = serializeModel(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
