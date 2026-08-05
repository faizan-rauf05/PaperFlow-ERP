import {
  GLUE_TYPE_CODE,
  INK_COLOR_CODE,
  KAPTON_TYPE_CODE,
  MATERIAL_TYPE_LABELS,
  MATERIAL_UNIT_BY_TYPE,
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

function formatWeight(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  return Number.isInteger(num) ? String(num) : String(num).replace(".", "");
}

function formatDimension(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  return Number.isInteger(num) ? String(num) : String(num);
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

/** Field-derived base code (without uniqueness suffix). */
export function generateMaterialBaseCode(input) {
  const { materialType } = input;
  if (!materialType) return "";

  switch (materialType) {
    case "PAPER_ROLL": {
      const paper = PAPER_TYPE_CODE[input.paperType];
      const gsm = input.gsm;
      const width = input.paperWidthMm;
      if (!paper || !gsm || !width) return "";
      return `PAPER-${paper}-${gsm}-${formatDimension(width)}`;
    }
    case "GLUE": {
      const glue = GLUE_TYPE_CODE[input.glueType];
      const weight = formatWeight(input.weightKg);
      if (!glue || !weight) return "";
      return `GLUE-${glue}-${weight}`;
    }
    case "INK": {
      const color = resolveInkColor(input.inkColor, input.inkColorCustom);
      const weight = formatWeight(input.weightKg);
      if (!color || !weight) return "";
      const colorCode = INK_COLOR_CODE[color] ?? slugify(color);
      return `INK-${colorCode}-${weight}`;
    }
    case "ROPE": {
      const color = ROPE_COLOR_CODE[input.ropeColor];
      const length = formatWeight(input.ropeLengthM);
      if (!color || !length || !weight) return "";
      return `ROPE-${color}-${length}-${weight}`;
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
      const size = slugify(input.cartonSize);
      const length = formatDimension(input.cartonLength);
      const width = formatDimension(input.cartonWidth);
      const height = input.cartonHeight
        ? formatDimension(input.cartonHeight)
        : "";
      if (!size || !length || !width) return "";
      const dims = height
        ? `${length}x${width}x${height}`
        : `${length}x${width}`;
      return `CTN-${size}-${dims}`;
    }
    default:
      return "";
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
  const width = input.paperWidthMm || 0;
  const timestamp = Date.now().toString().slice(-6);
  return `BC-${typeCode}-${colorCode}-${width}-${timestamp}`;
}

export function buildMaterialRecord(input) {
  const materialType = input.materialType;
  const code = generateMaterialCode(input);

  // Auto-generate name based on material parameters since manual Name field is removed
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
    name =
      `${pType} ${pColor} Paper Roll ${input.paperWidthMm ? input.paperWidthMm + "mm" : ""} ${input.gsm ? input.gsm + "gsm" : ""}`.trim();
  } else if (materialType === "KAPTON") {
    const tapeLabel =
      KAPTON_TYPES.find((t) => t.value === input.tapeType)?.label || "Tape";
    name = `${tapeLabel} ${input.size || ""}`.trim();
  } else if (materialType === "GLUE") {
    name =
      `${input.glueType || ""} Glue ${input.weightKg ? input.weightKg + "kg" : ""}`.trim();
  } else if (materialType === "INK") {
    const color = resolveInkColor(input.inkColor, input.inkColorCustom);
    name =
      `${color || ""} Ink ${input.weightKg ? input.weightKg + "kg" : ""}`.trim();
  } else if (materialType === "ROPE") {
    name =
      `${input.ropeColor || ""} Rope ${input.ropeLengthM ? input.ropeLengthM + "m" : ""}`.trim();
  } else if (materialType === "SPONGE") {
    name =
      `Sponge ${input.sheetCount ? input.sheetCount + " sheets" : ""}`.trim();
  } else {
    name = MATERIAL_TYPE_LABELS[materialType] || "Material";
  }

  const unit = getUnitForMaterialType(materialType, input);
  const supplier = input.supplier?.trim() || null;
  const inkColor =
    materialType === "INK"
      ? resolveInkColor(input.inkColor, input.inkColorCustom)
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
    minimumStock: 0,
    kgPerMeter: null,
    paperType: null,
    paperColor: null,
    paperLengthM: null,
    paperWidthMm: null,
    gsm: null,
    receivingDate: null,
    barCode: null,
    glueType: null,
    inkColor: null,
    weightKg: null,
    ropeColor: null,
    ropeLengthM: null,
    tapeType: null,
    size: null,
    sheetCount: null,
    cartonSize: null,
    cartonLength: null,
    cartonWidth: null,
    cartonHeight: null,
  };

  switch (materialType) {
    case "PAPER_ROLL":
      return {
        ...base,
        paperType: input.paperType || null,
        paperColor: input.paperColor || null,
        paperLengthM: input.paperLengthM || null,
        paperWidthMm: input.paperWidthMm || null,
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
        weightKg: input.weightKg,
      };
    case "INK":
      return {
        ...base,
        inkColor,
        weightKg: input.weightKg,
      };
    case "ROPE":
      return {
        ...base,
        ropeColor: input.ropeColor,
        ropeLengthM: input.ropeLengthM,
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
    case "CARTON":
      return {
        ...base,
        cartonSize: input.cartonSize?.trim() || null,
        cartonLength: input.cartonLength,
        cartonWidth: input.cartonWidth,
        cartonHeight: input.cartonHeight ?? null,
      };
    default:
      return base;
  }
}

export function materialToFormValues(material) {
  const inkPreset = ["CMYK", "WHITE", "VARNISH", "BLACK", "INK_FIXER"].includes(
    material.inkColor,
  )
    ? material.inkColor
    : material.inkColor
      ? "CUSTOM"
      : "";

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
    paperWidthMm: material.paperWidthMm ?? "",
    gsm: material.gsm ?? "",
    receivingDate: material.receivingDate
      ? new Date(material.receivingDate).toISOString().split("T")[0]
      : "",
    barCode: material.barCode ?? "",
    glueType: material.glueType ?? "",
    inkColor: inkPreset,
    inkColorCustom: inkPreset === "CUSTOM" ? (material.inkColor ?? "") : "",
    weightKg: material.weightKg ?? "",
    ropeColor: material.ropeColor ?? "",
    ropeLengthM: material.ropeLengthM ?? "",
    tapeType: material.tapeType ?? "",
    sheetCount: material.sheetCount ?? "",
    cartonSize: material.cartonSize ?? "",
    cartonLength: material.cartonLength ?? "",
    cartonWidth: material.cartonWidth ?? "",
    cartonHeight: material.cartonHeight ?? "",
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
        material.paperWidthMm ? `${material.paperWidthMm} mm` : null,
        material.paperLengthM ? `${material.paperLengthM} m` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    case "GLUE":
      return [
        material.glueType,
        material.weightKg ? `${material.weightKg} kg` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    case "INK":
      return [
        material.inkColor,
        material.weightKg ? `${material.weightKg} kg` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    case "ROPE":
      return [
        material.ropeColor,
        material.ropeLengthM ? `${material.ropeLengthM} m` : null,
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
      const dims = [
        material.cartonLength,
        material.cartonWidth,
        material.cartonHeight,
      ]
        .filter((v) => v != null)
        .join(" × ");
      return [material.cartonSize, dims ? `${dims} cm` : null]
        .filter(Boolean)
        .join(" · ");
    }
    default:
      return material.name ?? "";
  }
}
