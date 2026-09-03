import { NextResponse } from "next/server";
import sharp from "sharp";
import { requireAdminOrManager } from "@/lib/apiAuth";

export const runtime = "nodejs";

const CLAUDE_MODEL = "claude-haiku-4-5";

const extractionSchema = {
  type: "object",
  additionalProperties: false,

  properties: {
    readable: {
      type: "boolean",
      description:
        "false if the image is too blurry, too dark, cropped, or does not show a recognizable material label clearly enough to extract real values. When false, every other field must be left empty/0 — never guess.",
    },
    issueReason: {
      type: "string",
      description:
        "Short plain-language reason when readable=false (e.g. 'Image is too blurry to read the label text'). Empty string when readable=true.",
    },

    detectedRotation: {
      type: "number",
      enum: [0, 90, 180, 270],
      description:
        "Degrees to rotate the image CLOCKWISE so its printed text would be upright, left-to-right, top-to-bottom. 0 if the text is already upright. Always report this, even if the rotation makes extraction below unreliable.",
    },

    lowConfidenceFields: {
      type: "array",
      items: { type: "string" },
      description:
        "Dot-paths (e.g. 'paperRoll.gsm', 'paperRoll.paperColor') of every field you filled in from a default, an inference, an ambiguous choice between multiple candidates on the label, or a non-standard/unfamiliar layout — as opposed to a clear, explicit, unambiguous label value. Empty array only when every filled field was explicitly and unambiguously stated. Never used to avoid filling a field — fill your best answer, then flag it here if it's a guess.",
    },

    materialType: {
      type: "string",
      enum: ["PAPER_ROLL", "GLUE", "INK", "ROPE", "KAPTON"],
      description:
        "Never return CARTON or SPONGE — those material types are not extracted by this scanner right now.",
    },

    supplier: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: {
          type: "string",
          description: "Supplier/manufacturer name exactly as visible on label (e.g. Gulf Paper Manufacturing CO.). Empty string if not visible.",
        },
        address: {
          type: "string",
          description: "Physical address exactly as visible. Do not invent missing parts. Empty string if not visible.",
        },
        contactNumber: {
          type: "string",
          description: "Telephone or mobile number only. Exclude fax numbers. Empty string if not visible.",
        },
      },
      required: ["name", "address", "contactNumber"],
    },

    paperRoll: {
      type: "object",
      additionalProperties: false,
      properties: {
        paperType: {
          type: "string",
          description: "VIRGIN or RECYCLED. Default to VIRGIN unless RECYCLED is explicitly stated on the label.",
        },
        paperColor: {
          type: "string",
          description:
            "WHITE or BROWN. Use WHITE/BROWN only if a color word is explicitly on the label. If no color is stated anywhere, default to BROWN (natural unbleached kraft) and add paperRoll.paperColor to lowConfidenceFields.",
        },
        paperWidthCm: {
          type: "number",
          description: "Paper width in centimeters, from a Width(mm)-style cell divided by 10. 0 if unavailable.",
        },
        paperLengthM: {
          type: "number",
          description: "The roll's running length in meters, however labeled (Length, Lineal, LM, etc). Never the Diameter value.",
        },
        weightKg: {
          type: "number",
          description:
            "Roll net weight in KILOGRAMS specifically — from a cell/column labeled 'Weight (kg)' or similar metric unit. Some labels print weight in BOTH kg and lb as two separate cells (e.g. 'WEIGHT (kg): 1025' next to 'WEIGHT (lb): 2259', for the same roll) — always use the kg one; the lb number is roughly 2.2x larger and must never be used here even if it's the more visually prominent of the two. 0 if no kg-labeled weight is visible anywhere.",
        },
        gsm: {
          type: "number",
          description:
            "Grammage. Try these three positively-identified sources first — never a bare number that merely sits near a product/description name: " +
            "(1) a cell explicitly labeled Substance(gm2)/GSM/Grammage; " +
            "(2) a number with the literal letters 'GSM' or 'g/m2' GLUED directly onto it, no space — e.g. the '97.6' in '97.6GSM' inside 'B60 PTK 97.6GSM' counts, but a plain number with no such unit attached does not; " +
            "(3) a cell literally labeled 'Basis Weight' (a US unit, no metric shown) — e.g. 'BASIS WEIGHT: 89.0' -> gsm=89, copied unconverted. " +
            "A product/style number after a product name is NOT grammage — e.g. the '55' in 'MULTIKRAFT 55' is a product grade, not GSM. " +
            "FALLBACK, only when none of the three above is confidently identifiable: calculate estimated_gsm = (weightKg * 1000) / (paperLengthM * (paperWidthCm / 100)), using the weight/length/width you already read from this same roll. Then look back across the whole label for any other printed number within roughly 15% of that estimate that could plausibly be a weight-per-area value you weren't confident about — if one exists, use that printed number instead of your raw calculation. If none does, use the calculated estimate itself, rounded to one decimal. " +
            "Add paperRoll.gsm to lowConfidenceFields whenever the value came from source (3) or the fallback — never for a confident (1)/(2) match. " +
            "0 only if weight/length/width are also unavailable, making even a fallback estimate impossible.",
        },
        barCode: {
          type: "string",
          description:
            "The value printed with/under the actual barcode graphic — the roll's scannable identity — over any other order/PO/customer-reference number elsewhere on the label. If several candidate numbers exist and none is clearly barcode-tied, pick the one that reads like a unique roll/reel ID and add paperRoll.barCode to lowConfidenceFields.",
        },
        receivingDate: {
          type: "string",
          description: "Receiving or production date formatted as YYYY-MM-DD (e.g. 06/07/2026 -> 2026-07-06 or 2026-06-07). Empty string if not visible.",
        },
      },
      required: ["paperType", "paperColor", "paperWidthCm", "paperLengthM", "weightKg", "gsm", "barCode", "receivingDate"],
    },

    glue: {
      type: "object",
      additionalProperties: false,
      properties: {
        glueType: {
          type: "string",
          enum: ["HOT", "COLD", "CORE", ""],
          description: "Intelligently classify glue: CORE for paper tube winding/Core N glue; HOT for Hot Melt adhesives; COLD for PVA/Hexa Bond P-4038 liquid glue.",
        },
        weightKg: {
          type: "number",
          description: "Glue weight in kg. 0 if unavailable.",
        },
        gluePacks: {
          type: "number",
          description: "Number of glue packs or drums. 0 if unavailable.",
        },
        batchNo: {
          type: "string",
          description: "Batch number exactly as printed (e.g. from 'BATCH NO:'). Empty string if not visible.",
        },
        receivingDate: {
          type: "string",
          description: "Production date formatted as YYYY-MM-DD (from 'PRO.DATE' / 'Production Date'). Empty string if not visible.",
        },
      },
      required: ["glueType", "weightKg", "gluePacks", "batchNo", "receivingDate"],
    },

    ink: {
      type: "object",
      additionalProperties: false,
      properties: {
        inkColor: {
          type: "string",
          description: "CYAN, MAGENTA, YELLOW, WHITE, VARNISH, BLACK, INK_FIXER, or CUSTOM.",
        },
        inkColorCustom: {
          type: "string",
          description:
            "Only when inkColor is CUSTOM: the plain base color name in English (e.g. 'Red', 'Orange', 'Green') — strip any product/brand name around it (e.g. 'Safanova Red' -> 'Red', 'احمر' -> 'Red'). Never a product name. Otherwise empty string.",
        },
        weightKg: {
          type: "number",
          description: "Ink weight in kg. 0 if unavailable.",
        },
        inkDrums: {
          type: "number",
          description: "Number of ink drums or buckets. 0 if unavailable.",
        },
        batchNo: {
          type: "string",
          description: "Batch number exactly as printed (e.g. 'Batch No: 148856'). Empty string if not visible.",
        },
        receivingDate: {
          type: "string",
          description: "Production date formatted as YYYY-MM-DD (from 'Production Date'). Empty string if not visible.",
        },
      },
      required: ["inkColor", "inkColorCustom", "weightKg", "inkDrums", "batchNo", "receivingDate"],
    },

    rope: {
      type: "object",
      additionalProperties: false,
      properties: {
        ropeColor: {
          type: "string",
          description: "WHITE, BROWN, or BLACK.",
        },
        ropeLengthM: {
          type: "number",
          description: "Rope length in meters. 0 if unavailable.",
        },
        ropeRolls: {
          type: "number",
          description: "Number of rope rolls. 0 if unavailable.",
        },
        batchNo: {
          type: "string",
          description: "Batch number exactly as printed. Empty string if not visible.",
        },
        receivingDate: {
          type: "string",
          description: "Production date formatted as YYYY-MM-DD. Empty string if not visible.",
        },
      },
      required: ["ropeColor", "ropeLengthM", "ropeRolls", "batchNo", "receivingDate"],
    },
  },

  required: ["readable", "issueReason", "detectedRotation", "lowConfidenceFields", "materialType", "supplier"],
};

const systemPrompt = `You are a high-precision material label extraction system for PaperFlow ERP. Labels come from
many different vendors with different layouts, field names, and units — read for meaning, not by matching
one exact template. "Don't guess" means don't invent a number that isn't printed anywhere on the label — it
does NOT mean skip a field just because its value comes from an alternate source a field's instructions
describe (e.g. Basis Weight standing in for GSM). If a number is genuinely printed nowhere on the label,
that field gets its empty/0 default (or readable=false if nothing extracts); otherwise use what's there.

1. ROTATION (check first): determine detectedRotation — degrees clockwise to make the text upright. If the
label is sideways/upside down, direct extraction is unreliable, so set readable=false (a corrected retry
happens automatically) but still report your best detectedRotation. Otherwise detectedRotation=0.

2. READABILITY: if the image is too blurry, dark, cropped, or shows no recognizable material label, set
readable=false with a short reason in issueReason, and leave every other field at its empty/0 default.

3. EXTRACT (reason semantically — the same value can appear under different names per vendor; field-specific
sourcing rules like GSM/barcode/color/width/length live on each field's own description below, not repeated
here):
   - Dates: any format on the label (DD/MM/YYYY, DD-Mon-YY, etc) -> YYYY-MM-DD.
   - Glue type: CORE (Core N / tube winding), COLD (PVA, Hexa Bond / P-4038), HOT (hot melt, EVA).
   - Ink color: base color word only, brand/product name stripped (e.g. "Safanova Red K" -> "Red").
   - Batch number (glue/ink/rope only): exact as printed, paired with the production date in receivingDate —
     batch number alone isn't treated as unique in this system.
   - Every text field (supplier, address, colors, batch numbers, etc.) must be in English — translate
     non-English label text rather than copying it through. Numbers/codes/barcodes stay as printed.

4. CONFIDENCE: after extracting, list the dot-path of every field you filled from a default, an inference,
an ambiguous choice between multiple candidates, or an unfamiliar layout in lowConfidenceFields (e.g.
"paperRoll.gsm", "paperRoll.paperColor") — empty array only when every filled field was explicit and
unambiguous.

Return ONLY the material section matching materialType, plus supplier and confidence fields.`;

/**
 * One Claude call: extraction + rotation detection together (rotation is cheap
 * to report alongside a real extraction attempt, so this avoids a dedicated
 * pre-pass call for the common case of an already-upright photo). Throws on
 * transport/parse failure; caller decides how to handle a bad response.
 */
async function callExtraction(buffer, apiKey) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      system: systemPrompt,
      max_tokens: 500,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: buffer.toString("base64") },
            },
            {
              type: "text",
              text: "Extract material inventory data from this label image.",
            },
          ],
        },
      ],
      output_config: { format: { type: "json_schema", schema: extractionSchema } },
    }),
  });

  const resData = await response.json();

  if (!response.ok) {
    const error = new Error(resData?.error?.message || "AI scanner request failed");
    error.status = response.status;
    error.resData = resData;
    throw error;
  }

  if (resData?.stop_reason === "max_tokens") {
    const error = new Error("AI scanner response was truncated");
    error.status = 502;
    throw error;
  }

  if (resData?.stop_reason === "refusal") {
    const error = new Error("AI scanner refused to process the image");
    error.status = 422;
    throw error;
  }

  const rawContent = resData?.content?.find((item) => item?.type === "text")?.text;
  if (!rawContent) {
    const error = new Error("No data returned from AI scanner");
    error.status = 500;
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch (parseError) {
    console.error("Structured JSON parse failed:", { rawContent, parseError });
    const error = new Error("Invalid structured response from AI scanner");
    error.status = 502;
    throw error;
  }

  return { parsed, usage: resData?.usage };
}

async function prepareImage(base64) {
  const inputBuffer = Buffer.from(base64, "base64");

  if (!inputBuffer.length) {
    throw new Error("Invalid image data");
  }

  // 1568px is Anthropic's maximum visual resolution limit.
  // Provides max sharpness for small table grid numbers & dense barcode digits.
  const result = await sharp(inputBuffer)
    .rotate() // Auto-orient according to EXIF
    .resize({
      width: 1568,
      height: 1568,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({
      quality: 88,
      chromaSubsampling: "4:4:4",
    })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: result.data,
    width: result.info.width,
    height: result.info.height,
  };
}

export async function POST(request) {
  const startedAt = Date.now();

  try {
    const authResult = await requireAdminOrManager();

    if (authResult.error) {
      return NextResponse.json(authResult.error.body, {
        status: authResult.error.status,
      });
    }

    const body = await request.json();
    const imageBase64 = body?.imageBase64;

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        { error: "Image data is required" },
        { status: 400 },
      );
    }

    const apiKey = process.env.CLAUDE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Claude API key is not configured" },
        { status: 500 },
      );
    }

    const cleanBase64 = imageBase64
      .replace(/^data:image\/[\w.+-]+;base64,/i, "")
      .replace(/\s/g, "");

    let preparedImage;

    try {
      preparedImage = await prepareImage(cleanBase64);
    } catch (error) {
      console.error("Image preparation error:", error);
      return NextResponse.json(
        { error: "Invalid or unsupported image" },
        { status: 400 },
      );
    }

    let finalBuffer = preparedImage.buffer;
    let parsed;
    let usage;

    try {
      const first = await callExtraction(preparedImage.buffer, apiKey);
      parsed = first.parsed;
      usage = first.usage;

      // Only pay for a second call when the model actually flagged rotation —
      // the common case (already-upright photo) finishes in one call.
      if (parsed?.detectedRotation) {
        finalBuffer = await sharp(preparedImage.buffer)
          .rotate(parsed.detectedRotation)
          .jpeg({ quality: 88, chromaSubsampling: "4:4:4" })
          .toBuffer();
        const retry = await callExtraction(finalBuffer, apiKey);
        parsed = retry.parsed;
        usage = retry.usage;
      }
    } catch (error) {
      console.error("Claude API error:", error, error.resData);
      return NextResponse.json(
        { error: error.message || "AI scanner request failed" },
        { status: error.status || 500 },
      );
    }

    if (parsed?.readable === false) {
      console.info("Claude material scan rejected as unreadable:", {
        issueReason: parsed.issueReason,
      });
      return NextResponse.json(
        {
          error:
            parsed.issueReason ||
            "Image is unclear or no material label was detected. Please retake the photo with better lighting/focus and try again.",
        },
        { status: 422 },
      );
    }

    if (parsed?.paperRoll?.receivingDate === "") {
      parsed.paperRoll.receivingDate = null;
    }

    // Fail-safe post-processing for Glue Type detection
    if (parsed?.materialType === "GLUE" && parsed?.glue) {
      if (!parsed.glue.glueType || parsed.glue.glueType === "") {
        const fullPayloadText = JSON.stringify(parsed).toLowerCase();
        if (fullPayloadText.includes("core")) {
          parsed.glue.glueType = "CORE";
        } else if (fullPayloadText.includes("hot") || fullPayloadText.includes("melt") || fullPayloadText.includes("eva")) {
          parsed.glue.glueType = "HOT";
        } else if (fullPayloadText.includes("p-4038") || fullPayloadText.includes("p4038") || fullPayloadText.includes("hexa bond") || fullPayloadText.includes("hexabond")) {
          parsed.glue.glueType = "COLD";
        }
      }
    }

    const durationMs = Date.now() - startedAt;

    console.info("Claude material scan completed:", {
      model: CLAUDE_MODEL,
      durationMs,
      image: {
        width: preparedImage.width,
        height: preparedImage.height,
        bytes: finalBuffer.length,
        rotationCorrected: finalBuffer !== preparedImage.buffer,
      },
      usage,
      materialType: parsed?.materialType,
      paperRoll: parsed?.paperRoll,
    });

    return NextResponse.json({
      extracted: parsed,
    });
  } catch (error) {
    console.error("POST /api/materials/scan-label error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
