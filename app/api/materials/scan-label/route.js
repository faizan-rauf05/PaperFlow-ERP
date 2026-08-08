import { NextResponse } from "next/server";
import { requireAdminOrManager } from "@/lib/apiAuth";

export async function POST(request) {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, {
        status: authResult.error.status,
      });
    }

    const { imageBase64, mimeType } = await request.json();
    if (!imageBase64) {
      return NextResponse.json(
        { error: "Image data is required" },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenRouter API key is not configured" },
        { status: 500 },
      );
    }

    const promptText = `You are an industrial OCR extraction system. Analyze this material label image carefully. Rely strictly on information visible in the image. Do NOT hallucinate or assume non-existent values.

Return ONLY a valid JSON object matching this schema:

{
  "materialType": "PAPER_ROLL" | "GLUE" | "INK" | "ROPE" | "CARTON" | "KAPTON" | "SPONGE",
  "supplier": {
    "name": "Supplier or manufacturer company name (e.g. Gulf Paper Manufacturing CO.)",
    "companyName": "Full company name",
    "address": "Full physical address, street, area, city, country",
    "contactNumber": "Actual telephone or mobile number ONLY (e.g. +965-2326 2069). DO NOT include FAX numbers."
  },
  "paperRoll": {
    "paperType": "VIRGIN" or "RECYCLED" (default to "VIRGIN" if unspecified),
    "paperColor": "WHITE" or "BROWN" (decide based on label description e.g. White Kraft Paper -> WHITE),
    "paperWidthCm": number (convert mm to cm, e.g., 1010 mm -> 101),
    "paperLengthM": number (length in meters, e.g. 6096),
    "gsm": number (substance gsm, e.g. 100),
    "barCode": "String of the LONGEST barcode containing customer/reel reference (e.g. 0140650248510010107396096)",
    "receivingDate": "YYYY-MM-DD format if date is visible (e.g. 29/06/2026 -> 2026-06-29), or null if not visible"
  },
  "glue": {
    "glueType": "HOT" | "COLD" | "CORE",
    "weightKg": number,
    "gluePacks": number
  },
  "ink": {
    "inkColor": "CYAN" | "MAGENTA" | "YELLOW" | "WHITE" | "VARNISH" | "BLACK" | "INK_FIXER" | "CUSTOM",
    "inkColorCustom": "string",
    "weightKg": number,
    "inkDrums": number
  },
  "rope": {
    "ropeColor": "WHITE" | "BROWN" | "BLACK",
    "ropeLengthM": number,
    "ropeRolls": number
  },
  "carton": {
    "cartonSize": "SMALL" | "MEDIUM" | "LARGE" | "EXTRA_LARGE",
    "cartonQty": number
  }
}

Strict Rules:
1. Detect material type from image (PAPER_ROLL, INK, GLUE, ROPE, CARTON, KAPTON, SPONGE).
2. For contactNumber: Extract ONLY telephone/mobile numbers (e.g. Tel / Phone). Completely EXCLUDE Fax numbers.
3. For paperRoll.paperColor: Determine directly from label text (e.g., "WHITE KRAFT PAPER" -> WHITE, "BROWN KRAFT" -> BROWN).
4. For paperRoll.paperType: Default to "VIRGIN" if not explicitly specified as recycled.
5. For receivingDate: Format as YYYY-MM-DD if present on label; if absent, return null.
6. Do not include markdown code block syntax around output if possible, output clean JSON only.`;

    const cleanBase64 = imageBase64.replace(
      /^data:image\/[\w.+-]+;base64,/i,
      "",
    );

    const finalMimeType = mimeType || "image/jpeg";
    const imageDataUrl = `data:${finalMimeType};base64,${cleanBase64}`;

    const url = "https://openrouter.ai/api/v1/chat/completions";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.BASE_URL || "http://localhost:3000",
        "X-Title": "Paper Flow ERP - Material Label Scanner",
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: promptText,
              },
              {
                type: "image_url",
                image_url: {
                  url: imageDataUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 2048,
        temperature: 0,
        response_format: {
          type: "json_object",
        },
      }),
    });

    const resData = await response.json();
    const rawContent = resData?.choices?.[0]?.message?.content;

    if (!rawContent) {
      console.error("OpenRouter response:", resData);
      return NextResponse.json(
        { error: "No data returned from AI scanner" },
        { status: 500 },
      );
    }

    let parsed;
    try {
      const cleanJson = rawContent
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      parsed = JSON.parse(cleanJson);
    } catch (e) {
      console.error("Failed to parse OpenRouter JSON:", rawContent);
      return NextResponse.json(
        { error: "Invalid JSON from AI scanner" },
        { status: 500 },
      );
    }

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
