import {
  CARTON_SIZE_CODE,
  CARTON_SIZES,
  GLUE_TYPE_CODE,
  INK_COLOR_CODE,
  KAPTON_TYPE_CODE,
  KAPTON_TYPES,
  MATERIAL_TYPE_LABELS,
  MATERIAL_UNIT_BY_TYPE,
  PAPER_COLOR_CODE,
  PAPER_TYPE_CODE,
  ROPE_COLOR_CODE,
} from "@/lib/material-constants";

function slugify(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
}

export function createCodeSuffix() {
  return `T${Date.now().toString(36).toUpperCase()}`;
}

export function extractCodeSuffix(code) {
  if (!code || typeof code !== "string") return "";
  const last = code.split("-").pop() || "";
  if (/^T[A-Z0-9]+$/i.test(last)) {
    return last.toUpperCase();
  }
  return "";
}

export function resolveInkColor(inkColor, inkColorCustom) {
  if (inkColor === "CUSTOM") {
    return inkColorCustom?.trim() || "";
  }
  return inkColor?.trim() || "";
}

export function resolveRopeLength(ropeLength, ropeLengthCustom) {
  if (ropeLength === "CUSTOM") {
    return ropeLengthCustom !== undefined && ropeLengthCustom !== ""
      ? Number(ropeLengthCustom)
      : null;
  }
  return ropeLength !== undefined && ropeLength !== "" ? Number(ropeLength) : null;
}

/** Field-derived base code (without uniqueness suffix). */
export function generateMaterialBaseCode(input) {
  const { materialType } = input;
  if (!materialType) return "";

  switch (materialType) {
    case "PAPER_ROLL": {
      const paper = PAPER_TYPE_CODE[input.paperType];
      const color = PAPER_COLOR_CODE[input.paperColor];
      if (!paper || !color) return "";
      return `PAPER-${paper}-${color}`;
    }
    case "GLUE": {
      const glue = GLUE_TYPE_CODE[input.glueType];
      if (!glue) return "";
      return `GLUE-${glue}`;
    }
    case "INK": {
      const color = resolveInkColor(input.inkColor, input.inkColorCustom);
      if (!color) return "";
      const colorCode = INK_COLOR_CODE[color] ?? slugify(color);
      return `INK-${colorCode}`;
    }
    case "ROPE": {
      const color = ROPE_COLOR_CODE[input.ropeColor];
      if (!color) return "";
      return `ROPE-${color}`;
    }
    case "KAPTON": {
      const type = KAPTON_TYPE_CODE[input.tapeType];
      const size = slugify(input.size);
      const unit = slugify(input.unit);
      if (!type || !size || !unit) return "";
      return `KAPTON-${type}-${size}-${unit}`;
    }
    case "SPONGE": {
      const sheets = input.sheetCount;
      if (!sheets) return "";
      return `SPONGE-${sheets}`;
    }
    case "CARTON": {
      const sizeCode = CARTON_SIZE_CODE[input.cartonSize] ?? slugify(input.cartonSize);
      if (!sizeCode) return "";
      return `CTN-${sizeCode}`;
    }
    default:
      return "";
  }
}

/**
 * Initial stock quantity for a freshly created material, as "amount per unit x count"
 * rather than picking a single field. `record` is the buildMaterialRecord() output.
 */
export function computeInitialStockQty(materialType, record) {
  const num = (v) => (v != null && Number(v) > 0 ? Number(v) : 0);

  switch (materialType) {
    case "PAPER_ROLL":
      return num(record.paperLengthM);
    case "GLUE":
    case "INK": {
      const perUnit = num(record.weightKg);
      const count = materialType === "GLUE" ? num(record.gluePacks) : num(record.inkDrums);
      return perUnit * Math.max(count, 1);
    }
    case "ROPE":
      return num(record.ropeLengthM) * Math.max(num(record.ropeRolls), 1);
    case "CARTON":
      return num(record.cartonsPerBundle) * Math.max(num(record.bundleQty), 1);
    case "SPONGE":
      return num(record.sheetCount);
    default:
      return 0;
  }
}

export function generateMaterialCode(input) {
  const base = generateMaterialBaseCode(input);
  if (!base) return "";
  const suffix =
    (input.codeSuffix || "").trim().toUpperCase() || createCodeSuffix();
  return `${base}-${suffix}`;
}

export function getUnitForMaterialType(materialType, input) {
  if (materialType === "KAPTON") {
    return input?.unit?.trim() || MATERIAL_UNIT_BY_TYPE.KAPTON;
  }
  return MATERIAL_UNIT_BY_TYPE[materialType] ?? "PCS";
}

export function generatePaperRollBarcode(input) {
  const typeCode =
    input.paperType === "RECYCLED"
      ? "REC"
      : input.paperType === "VIRGIN"
        ? "VRG"
        : "PR";
  const colorCode =
    input.paperColor === "BROWN"
      ? "BRN"
      : input.paperColor === "WHITE"
        ? "WHT"
        : "CLR";
  const width = input.paperWidthCm || 0;
  const timestamp = Date.now().toString().slice(-6);
  return `BC-${typeCode}-${colorCode}-${width}-${timestamp}`;
}

export function buildMaterialRecord(input) {
  const materialType = input.materialType;
  const code = generateMaterialCode(input);

  let name = "";
  if (materialType === "PAPER_ROLL") {
    const pType =
      input.paperType === "RECYCLED"
        ? "Recycled"
        : input.paperType === "VIRGIN"
          ? "Virgin"
          : "Paper";
    const pColor =
      input.paperColor === "BROWN"
        ? "Brown"
        : input.paperColor === "WHITE"
          ? "White"
          : "";
    const wCm = input.paperWidthCm ? `${input.paperWidthCm}cm` : "";
    const gsmStr = input.gsm ? `${input.gsm}gsm` : "";
    name = `${pType} ${pColor} Paper Roll ${wCm} ${gsmStr}`.trim();
  } else if (materialType === "KAPTON") {
    const tapeLabel =
      KAPTON_TYPES.find((t) => t.value === input.tapeType)?.label || "Tape";
    name = `${tapeLabel} ${input.size || ""}`.trim();
  } else if (materialType === "GLUE") {
    const packStr = input.gluePacks ? `${input.gluePacks} packs` : "";
    const wtStr = input.weightKg ? `${input.weightKg}kg` : "";
    name = `${input.glueType || ""} Glue ${wtStr} ${packStr}`.trim();
  } else if (materialType === "INK") {
    const color = resolveInkColor(input.inkColor, input.inkColorCustom);
    const drumStr = input.inkDrums ? `${input.inkDrums} drums` : "";
    const wtStr = input.weightKg ? `${input.weightKg}kg` : "";
    name = `${color || ""} Ink ${wtStr} ${drumStr}`.trim();
  } else if (materialType === "ROPE") {
    const rLen = resolveRopeLength(input.ropeLengthM, input.ropeLengthMCustom);
    const rollStr = input.ropeRolls ? `${input.ropeRolls} rolls` : "";
    const lenStr = rLen ? `${rLen}m` : "";
    name = `${input.ropeColor || ""} Rope ${lenStr} ${rollStr}`.trim();
  } else if (materialType === "SPONGE") {
    name = `Sponge ${input.sheetCount ? input.sheetCount + " sheets" : ""}`.trim();
  } else if (materialType === "CARTON") {
    const sizeLabel = CARTON_SIZES.find((s) => s.value === input.cartonSize)?.label || input.cartonSize || "Carton";
    const qtyStr = input.cartonQty ? `${input.cartonQty} cartons` : "";
    name = `${sizeLabel} Carton ${qtyStr}`.trim();
  } else {
    name = MATERIAL_TYPE_LABELS[materialType] || "Material";
  }

  const unit = getUnitForMaterialType(materialType, input);
  const supplier = input.supplier?.trim() || null;
  const inkColor =
    materialType === "INK"
      ? resolveInkColor(input.inkColor, input.inkColorCustom)
      : null;
  const ropeLen =
    materialType === "ROPE"
      ? resolveRopeLength(input.ropeLengthM, input.ropeLengthMCustom)
      : null;
  const barCode =
    materialType === "PAPER_ROLL"
      ? input.barCode?.trim() || generatePaperRollBarcode(input)
      : null;

  const base = {
    materialType,
    name,
    code,
    supplier,
    unit,
    imageUrl: input.imageUrl || null,
    minimumStock: 0,
    kgPerMeter: null,
    paperType: null,
    paperColor: null,
    paperLengthM: null,
    paperWidthCm: null,
    gsm: null,
    receivingDate: null,
    barCode: null,
    batchNo: null,
    glueType: null,
    inkColor: null,
    weightKg: null,
    ropeColor: null,
    ropeLengthM: null,
    ropeRolls: null,
    gluePacks: null,
    inkDrums: null,
    cartonQty: null,
    cartonsPerBundle: null,
    bundleQty: null,
    tapeType: null,
    size: null,
    sheetCount: null,
    cartonSize: null,
  };

  switch (materialType) {
    case "PAPER_ROLL":
      return {
        ...base,
        paperType: input.paperType || null,
        paperColor: input.paperColor || null,
        paperLengthM: input.paperLengthM || null,
        paperWidthCm: input.paperWidthCm || null,
        weightKg: input.weightKg || null,
        gsm: input.gsm || null,
        receivingDate: input.receivingDate
          ? new Date(input.receivingDate)
          : null,
        barCode,
      };
    case "GLUE":
      return {
        ...base,
        glueType: input.glueType,
        weightKg: input.weightKg || null,
        gluePacks: input.gluePacks || null,
        batchNo: input.batchNo?.trim() || null,
        receivingDate: input.receivingDate
          ? new Date(input.receivingDate)
          : null,
      };
    case "INK":
      return {
        ...base,
        inkColor,
        weightKg: input.weightKg || null,
        inkDrums: input.inkDrums || null,
        batchNo: input.batchNo?.trim() || null,
        receivingDate: input.receivingDate
          ? new Date(input.receivingDate)
          : null,
      };
    case "ROPE":
      return {
        ...base,
        ropeColor: input.ropeColor,
        ropeLengthM: ropeLen,
        ropeRolls: input.ropeRolls || null,
        batchNo: input.batchNo?.trim() || null,
        receivingDate: input.receivingDate
          ? new Date(input.receivingDate)
          : null,
      };
    case "KAPTON":
      return {
        ...base,
        tapeType: input.tapeType || null,
        size: input.size?.trim() || null,
        unit: input.unit?.trim() || "PCS",
      };
    case "SPONGE":
      return {
        ...base,
        sheetCount: input.sheetCount,
      };
    case "CARTON": {
      const cartonsPerBundle = input.cartonsPerBundle || null;
      const bundleQty = input.bundleQty || null;
      return {
        ...base,
        cartonSize: input.cartonSize || null,
        cartonsPerBundle,
        bundleQty,
        cartonQty:
          cartonsPerBundle && bundleQty
            ? cartonsPerBundle * bundleQty
            : cartonsPerBundle || null,
      };
    }
    default:
      return base;
  }
}

export function materialToFormValues(material) {
  const inkPreset = ["CYAN", "MAGENTA", "YELLOW", "WHITE", "VARNISH", "BLACK", "INK_FIXER"].includes(
    material.inkColor,
  )
    ? material.inkColor
    : material.inkColor
      ? "CUSTOM"
      : "";

  const ropeLenNum = material.ropeLengthM != null ? Number(material.ropeLengthM) : "";
  const isRopeLenPreset = [5000, 12500].includes(ropeLenNum);
  const ropeLengthPreset = isRopeLenPreset ? String(ropeLenNum) : ropeLenNum !== "" ? "CUSTOM" : "";
  const ropeLengthCustom = !isRopeLenPreset && ropeLenNum !== "" ? String(ropeLenNum) : "";

  return {
    materialType: material.materialType ?? "",
    name: material.name ?? "",
    supplier: material.supplier ?? "",
    code: material.code ?? "",
    codeSuffix: extractCodeSuffix(material.code) || createCodeSuffix(),
    unit: material.materialType === "KAPTON" ? (material.unit ?? "") : "",
    size: material.size ?? "",
    paperType: material.paperType ?? "",
    paperColor: material.paperColor ?? "",
    paperLengthM: material.paperLengthM ?? "",
    paperWidthCm: material.paperWidthCm ?? "",
    gsm: material.gsm ?? "",
    receivingDate: material.receivingDate
      ? new Date(material.receivingDate).toISOString().split("T")[0]
      : "",
    barCode: material.barCode ?? "",
    batchNo: material.batchNo ?? "",
    glueType: material.glueType ?? "",
    gluePacks: material.gluePacks ?? "",
    inkColor: inkPreset,
    inkColorCustom: inkPreset === "CUSTOM" ? (material.inkColor ?? "") : "",
    weightKg: material.weightKg ?? "",
    inkDrums: material.inkDrums ?? "",
    ropeColor: material.ropeColor ?? "",
    ropeLengthM: ropeLengthPreset,
    ropeLengthMCustom: ropeLengthCustom,
    ropeRolls: material.ropeRolls ?? "",
    tapeType: material.tapeType ?? "",
    sheetCount: material.sheetCount ?? "",
    cartonSize: material.cartonSize ?? "",
    cartonsPerBundle: material.cartonsPerBundle ?? "",
    bundleQty: material.bundleQty ?? "",
    imageUrl: material.imageUrl ?? "",
  };
}

export function getMaterialSummary(material) {
  switch (material.materialType) {
    case "PAPER_ROLL":
      return [
        material.paperType === "RECYCLED"
          ? "Recycled"
          : material.paperType === "VIRGIN"
            ? "Virgin"
            : null,
        material.paperColor === "BROWN"
          ? "Brown"
          : material.paperColor === "WHITE"
            ? "White"
            : null,
        material.gsm ? `${material.gsm} gsm` : null,
        material.paperWidthCm ? `${material.paperWidthCm} cm` : null,
        material.paperLengthM ? `${material.paperLengthM} m` : null,
        material.weightKg ? `${material.weightKg} kg` : null,
        material.barCode ? `#${material.barCode}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    case "GLUE":
      return [
        material.glueType,
        material.weightKg ? `${material.weightKg} kg/pack` : null,
        material.gluePacks ? `${material.gluePacks} packs` : null,
        material.batchNo ? `Batch ${material.batchNo}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    case "INK":
      return [
        material.inkColor,
        material.weightKg ? `${material.weightKg} kg/drum` : null,
        material.inkDrums ? `${material.inkDrums} drums` : null,
        material.batchNo ? `Batch ${material.batchNo}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    case "ROPE":
      return [
        material.ropeColor,
        material.ropeLengthM ? `${material.ropeLengthM} m` : null,
        material.ropeRolls ? `${material.ropeRolls} rolls` : null,
        material.batchNo ? `Batch ${material.batchNo}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    case "KAPTON":
      return [
        KAPTON_TYPES.find((t) => t.value === material.tapeType)?.label ||
          material.tapeType,
        material.size,
        material.unit,
      ]
        .filter(Boolean)
        .join(" · ");
    case "SPONGE":
      return material.sheetCount ? `${material.sheetCount} sheets` : "";
    case "CARTON": {
      const sizeLabel = CARTON_SIZES.find((s) => s.value === material.cartonSize)?.label || material.cartonSize;
      return [
        sizeLabel,
        material.bundleQty && material.cartonsPerBundle
          ? `${material.bundleQty} bundles × ${material.cartonsPerBundle}`
          : null,
        material.cartonQty ? `${material.cartonQty} cartons total` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    default:
      return material.name ?? "";
  }
}
