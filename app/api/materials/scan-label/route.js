import { NextResponse } from "next/server";
import sharp from "sharp";
import { requireAdminOrManager } from "@/lib/apiAuth";

export const runtime = "nodejs";

const CLAUDE_MODEL = "claude-haiku-4-5";

const extractionSchema = {
  type: "object",
  additionalProperties: false,

  properties: {
    materialType: {
      type: "string",
      enum: ["PAPER_ROLL", "GLUE", "INK", "ROPE", "CARTON", "KAPTON", "SPONGE"],
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
          description: "WHITE or BROWN based on label text (e.g. BROWN KRAFT PAPER = BROWN, WHITE KRAFT PAPER = WHITE).",
        },
        paperWidthCm: {
          type: "number",
          description: "Paper width in centimeters. Convert Width (mm) to cm by dividing by 10 (e.g. 0950 mm -> 95, 1070 mm -> 107, 800 mm -> 80). 0 if unavailable.",
        },
        paperLengthM: {
          type: "number",
          description: "Paper length in meters from the 'Length (meters)' or 'Length (m)' cell ONLY (e.g. 5695). Do NOT use 'Diameters (mm)' value!",
        },
        gsm: {
          type: "number",
          description: "Paper grammage in GSM from 'Substance (gm2)' or 'GSM' cell ONLY (e.g. 100). Do NOT use 'Weight (Kgs)' value!",
        },
        barCode: {
          type: "string",
          description: "Full numeric/alphanumeric barcode string (e.g. 0141705248810009503455695) printed under the barcode graphic or listed as Customer Reference. Do NOT return short order initials like SON260214.",
        },
        receivingDate: {
          type: "string",
          description: "Receiving or production date formatted as YYYY-MM-DD (e.g. 06/07/2026 -> 2026-07-06 or 2026-06-07). Empty string if not visible.",
        },
      },
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
      },
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
          description: "Custom ink color or Pantone name if inkColor is CUSTOM. Otherwise empty string.",
        },
        weightKg: {
          type: "number",
          description: "Ink weight in kg. 0 if unavailable.",
        },
        inkDrums: {
          type: "number",
          description: "Number of ink drums or buckets. 0 if unavailable.",
        },
      },
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
      },
    },

    carton: {
      type: "object",
      additionalProperties: false,
      properties: {
        cartonSize: {
          type: "string",
          description: "SMALL, MEDIUM, LARGE, or EXTRA_LARGE.",
        },
        cartonQty: {
          type: "number",
          description: "Carton quantity. 0 if unavailable.",
        },
      },
    },
  },

  required: ["materialType", "supplier"],
};

const systemPrompt = `You are an ultra-fast, high-precision OCR and material label extraction system for PaperFlow ERP.
Extract inventory specifications from material label images with 100% precision.

CRITICAL EXTRACTION RULES FOR BARCODE & SPECIFICATIONS:
1. FULL BARCODE EXTRACTION (STRICT):
   - Extract the FULL numeric/alphanumeric barcode digits string (e.g. "0141705248810009503455695").
   - Always prioritize the complete long barcode string printed under the barcode graphic or listed as "Customer Reference" / "Reel Barcode".
   - Do NOT return short order initials/references (such as "SON260214") in the barCode field when full barcode digits are visible!

2. WIDTH (mm -> cm):
   - Locate the "Width (mm)" cell.
   - Convert millimeters to centimeters by dividing by 10 (e.g. "0950" mm -> 95 cm, "1070" mm -> 107 cm).
   - Example: "Width (mm): 0950" = 95 cm.

3. LENGTH (METERS):
   - Locate the "Length (meters)" cell.
   - Do NOT confuse Length with "Diameters (mm)"!
   - Example: "Length (meters): 5695" -> paperLengthM = 5695 (NOT 1007, which is Diameter!).

4. GSM / SUBSTANCE (g/m2):
   - Locate the "Substance (gm2)" or "GSM" cell.
   - Do NOT confuse Substance/GSM with "Weight (Kgs)"!
   - Example: "Substance (gm2): 100" -> gsm = 100 (NOT 345, which is Weight in Kgs!).

5. RECEIVING / PRODUCTION DATE:
   - Format "Production Date" as YYYY-MM-DD (e.g., 06/07/2026 -> 2026-07-06 or 2026-06-07).

6. PAPER COLOR & TYPE:
   - "BROWN KRAFT PAPER" -> paperColor = "BROWN", paperType = "VIRGIN".

7. GLUE CLASSIFICATION (HOT, COLD, CORE):
   - CORE: "Hexabond Core N", "Core Winding Glue".
   - COLD: "Hexa Bond P-4038", "Hexabond P-4038", PVA liquid glue.
   - HOT: "Hot Melt adhesive", EVA glue.

8. INK COLOR CLASSIFICATION:
   - Match CYAN, MAGENTA, YELLOW, WHITE, VARNISH, BLACK, INK_FIXER, or set CUSTOM with inkColorCustom.

Return ONLY the material section corresponding to the detected materialType along with supplier details.`;

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

    const optimizedBase64 = preparedImage.buffer.toString("base64");

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
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: optimizedBase64,
                },
              },
              {
                type: "text",
                text: "Extract material inventory data from this label image.",
              },
            ],
          },
        ],

        output_config: {
          format: {
            type: "json_schema",
            schema: extractionSchema,
          },
        },
      }),
    });

    const resData = await response.json();

    if (!response.ok) {
      console.error("Claude API error:", resData);
      return NextResponse.json(
        {
          error: resData?.error?.message || "AI scanner request failed",
        },
        { status: response.status },
      );
    }

    if (resData?.stop_reason === "max_tokens") {
      console.error("Claude response hit max_tokens:", { usage: resData?.usage });
      return NextResponse.json(
        { error: "AI scanner response was truncated" },
        { status: 502 },
      );
    }

    if (resData?.stop_reason === "refusal") {
      console.error("Claude refused the request:", resData);
      return NextResponse.json(
        { error: "AI scanner refused to process the image" },
        { status: 422 },
      );
    }

    const rawContent = resData?.content?.find(
      (item) => item?.type === "text",
    )?.text;

    if (!rawContent) {
      console.error("Claude API response contained no text:", resData);
      return NextResponse.json(
        { error: "No data returned from AI scanner" },
        { status: 500 },
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (error) {
      console.error("Structured JSON parse failed:", { rawContent, error });
      return NextResponse.json(
        { error: "Invalid structured response from AI scanner" },
        { status: 502 },
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
        bytes: preparedImage.buffer.length,
      },
      usage: resData?.usage,
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
