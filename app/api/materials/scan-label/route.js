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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key is not configured" },
        { status: 500 },
      );
    }

    const promptText = `You are an OCR extraction system. Analyze this industrial raw material label/document image carefully. Extract only information visible in the image. Extract all available material specifications and supplier details.
Return ONLY a valid JSON object conforming strictly to this JSON structure:

{
  "materialType": "PAPER_ROLL",
  "supplier": {
    "name": "Extracted company/manufacturer name e.g. Gulf Paper Manufacturing CO.",
    "companyName": "Full company name",
    "address": "Full physical address e.g. Shuaiba Industrial Area, Mina Abdullah, Kuwait",
    "contactNumber": "Extracted phone/fax numbers e.g. +965-2326 2069"
  },
  "paperRoll": {
    "paperType": "VIRGIN",
    "paperColor": "WHITE",
    "paperWidthCm": 101,
    "paperLengthM": 6096,
    "gsm": 100,
    "barCode": "Longer customer reference barcode string (e.g. 0140650248510010107396096). ALWAYS select the LONGEST barcode string containing customer reference numbers.",
    "receivingDate": "2026-06-29"
  },
  "glue": {
    "glueType": "HOT",
    "weightKg": 18,
    "gluePacks": 1
  },
  "ink": {
    "inkColor": "CYAN",
    "inkColorCustom": "",
    "weightKg": 18,
    "inkDrums": 1
  },
  "rope": {
    "ropeColor": "WHITE",
    "ropeLengthM": 5000,
    "ropeRolls": 1
  },
  "carton": {
    "cartonSize": "MEDIUM",
    "cartonQty": 100
  }
}

Instructions:
1. If the label is for Paper Roll (e.g. White Kraft Paper, Recycled Paper Reel), set materialType to "PAPER_ROLL". Convert Width from mm to cm (e.g. 1010 mm -> 101).
2. For Barcode, locate the longer barcode string containing customer/reel reference (e.g. 0140650248510010107396096 or WKP-100-1010-107).
3. If dates are present (e.g. 29/06/2026), format as YYYY-MM-DD (2026-06-29).
4. Do not include markdown ticks around JSON if possible or output clean JSON only.`;

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: promptText },
              {
                inline_data: {
                  mime_type: mimeType || "image/jpeg",
                  data: cleanBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", errText);
      return NextResponse.json(
        { error: "Failed to analyze image with Gemini AI" },
        { status: 500 },
      );
    }

    const resData = await response.json();
    const rawContent = resData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawContent) {
      return NextResponse.json(
        { error: "No data returned from AI scanner" },
        { status: 500 },
      );
    }

    let parsed = {};
    try {
      const cleanJson = rawContent
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();
      parsed = JSON.parse(cleanJson);
    } catch (e) {
      console.error("Failed to parse Gemini JSON:", rawContent);
      return NextResponse.json(
        { error: "Invalid JSON from AI scanner" },
        { status: 500 },
      );
    }

    return NextResponse.json({ extracted: parsed });
  } catch (error) {
    console.error("POST /api/materials/scan-label error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
