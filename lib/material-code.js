import {
  GLUE_TYPE_CODE,
  INK_COLOR_CODE,
  MATERIAL_TYPE_LABELS,
  MATERIAL_UNIT_BY_TYPE,
  PAPER_TYPE_CODE,
  ROPE_COLOR_CODE,
  TAPE_TYPE_CODE,
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

export function resolveInkColor(inkColor, inkColorCustom) {
  if (inkColor === "CUSTOM") {
    return inkColorCustom?.trim() || "";
  }
  return inkColor?.trim() || "";
}

export function generateMaterialCode(input) {
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
      const weight = formatWeight(input.ropeWeightKg);
      if (!color || !length || !weight) return "";
      return `ROPE-${color}-${length}-${weight}`;
    }
    case "TAPE": {
      const tape = TAPE_TYPE_CODE[input.tapeType];
      if (!tape) return "";
      return `TAPE-${tape}`;
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
      const height = input.cartonHeight ? formatDimension(input.cartonHeight) : "";
      if (!size || !length || !width) return "";
      const dims = height ? `${length}x${width}x${height}` : `${length}x${width}`;
      return `CTN-${size}-${dims}`;
    }
    default:
      return "";
  }
}

export function generateMaterialName(input) {
  const { materialType } = input;
  if (!materialType) return "";

  switch (materialType) {
    case "PAPER_ROLL": {
      const paperLabel = input.paperType === "WHITE" ? "White" : "Brown";
      const parts = [paperLabel, "Paper"];
      if (input.gsm) parts.push(`${input.gsm}gsm`);
      if (input.paperWidthMm) parts.push(`${input.paperWidthMm}mm`);
      if (input.paperLengthM) parts.push(`${input.paperLengthM}m`);
      return parts.join(" ");
    }
    case "GLUE": {
      const glueLabel = { HOT: "Hot Glue", COLD: "Cold Glue", CORE: "Core Glue" }[input.glueType] ?? "Glue";
      return input.weightKg ? `${glueLabel} ${input.weightKg}kg` : glueLabel;
    }
    case "INK": {
      const color = resolveInkColor(input.inkColor, input.inkColorCustom) || "Ink";
      return input.weightKg ? `${color} Ink ${input.weightKg}kg` : `${color} Ink`;
    }
    case "ROPE": {
      const color = input.ropeColor ? `${input.ropeColor[0]}${input.ropeColor.slice(1).toLowerCase()}` : "Rope";
      const parts = [`${color} Rope`];
      if (input.ropeLengthM) parts.push(`${input.ropeLengthM}m`);
      if (input.ropeWeightKg) parts.push(`${input.ropeWeightKg}kg`);
      return parts.join(" ");
    }
    case "TAPE": {
      const tapeLabel = {
        FLEXP: "Flexp Tape",
        WHITE_DS: "White Double Side Tape",
        MACHINE_BLACK: "Machine Black Duck Tape",
      }[input.tapeType];
      return tapeLabel ?? "Tape";
    }
    case "SPONGE":
      return input.sheetCount ? `Sponge ${input.sheetCount} sheets` : "Sponge";
    case "CARTON": {
      const parts = [input.cartonSize || "Carton"];
      const dims = [
        input.cartonLength,
        input.cartonWidth,
        input.cartonHeight,
      ].filter((v) => v !== "" && v != null);
      if (dims.length) parts.push(`${dims.join(" x ")} cm`);
      return parts.join(" — ");
    }
    default:
      return MATERIAL_TYPE_LABELS[materialType] ?? "Material";
  }
}

export function getUnitForMaterialType(materialType) {
  return MATERIAL_UNIT_BY_TYPE[materialType] ?? "PCS";
}

export function buildMaterialRecord(input) {
  const materialType = input.materialType;
  const code = generateMaterialCode(input);
  const name = generateMaterialName(input);
  const unit = getUnitForMaterialType(materialType);
  const supplier = input.supplier?.trim() || null;
  const inkColor = materialType === "INK" ? resolveInkColor(input.inkColor, input.inkColorCustom) : null;

  const base = {
    materialType,
    name,
    code,
    supplier,
    unit,
    minimumStock: 0,
    kgPerMeter: null,
    paperType: null,
    paperLengthM: null,
    paperWidthMm: null,
    gsm: null,
    glueType: null,
    inkColor: null,
    weightKg: null,
    ropeColor: null,
    ropeLengthM: null,
    ropeWeightKg: null,
    tapeType: null,
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
        paperType: input.paperType,
        paperLengthM: input.paperLengthM,
        paperWidthMm: input.paperWidthMm,
        gsm: input.gsm,
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
        ropeWeightKg: input.ropeWeightKg,
      };
    case "TAPE":
      return {
        ...base,
        tapeType: input.tapeType,
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
  const inkPreset = ["CMYK", "WHITE", "VARNISH", "BLACK", "INK_FIXER"].includes(material.inkColor)
    ? material.inkColor
    : material.inkColor
      ? "CUSTOM"
      : "";

  return {
    materialType: material.materialType ?? "",
    supplier: material.supplier ?? "",
    code: material.code ?? "",
    paperType: material.paperType ?? "",
    paperLengthM: material.paperLengthM ?? "",
    paperWidthMm: material.paperWidthMm ?? "",
    gsm: material.gsm ?? "",
    glueType: material.glueType ?? "",
    inkColor: inkPreset,
    inkColorCustom: inkPreset === "CUSTOM" ? (material.inkColor ?? "") : "",
    weightKg: material.weightKg ?? "",
    ropeColor: material.ropeColor ?? "",
    ropeLengthM: material.ropeLengthM ?? "",
    ropeWeightKg: material.ropeWeightKg ?? "",
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
        material.paperType === "WHITE" ? "White" : material.paperType === "BROWN" ? "Brown" : null,
        material.gsm ? `${material.gsm} gsm` : null,
        material.paperWidthMm ? `${material.paperWidthMm} mm` : null,
        material.paperLengthM ? `${material.paperLengthM} m` : null,
      ].filter(Boolean).join(" · ");
    case "GLUE":
      return [
        material.glueType,
        material.weightKg ? `${material.weightKg} kg` : null,
      ].filter(Boolean).join(" · ");
    case "INK":
      return [
        material.inkColor,
        material.weightKg ? `${material.weightKg} kg` : null,
      ].filter(Boolean).join(" · ");
    case "ROPE":
      return [
        material.ropeColor,
        material.ropeLengthM ? `${material.ropeLengthM} m` : null,
        material.ropeWeightKg ? `${material.ropeWeightKg} kg` : null,
      ].filter(Boolean).join(" · ");
    case "TAPE":
      return material.tapeType?.replace(/_/g, " ") ?? "";
    case "SPONGE":
      return material.sheetCount ? `${material.sheetCount} sheets` : "";
    case "CARTON": {
      const dims = [material.cartonLength, material.cartonWidth, material.cartonHeight]
        .filter((v) => v != null)
        .join(" × ");
      return [material.cartonSize, dims ? `${dims} cm` : null].filter(Boolean).join(" · ");
    }
    default:
      return material.name ?? "";
  }
}
