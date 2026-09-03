import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { getSignedPdfDownloadUrl } from "@/lib/cloudinary";

/**
 * Streams the quote PDF through our own server rather than linking the browser
 * directly to Cloudinary — the file is stored as an authenticated/private asset
 * (see lib/cloudinary.js), so this generates a fresh signed download URL on
 * every request and proxies the bytes back with the right content-type.
 */
export async function GET(request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id } = await params;
    const quote = await prisma.customerQuoteApproval.findFirst({
      where: { orderId: id },
      orderBy: { generatedAt: "desc" },
    });

    if (!quote?.pdfUrl) {
      return NextResponse.json({ error: "No quote PDF found for this order" }, { status: 404 });
    }

    const signedUrl = getSignedPdfDownloadUrl(quote.pdfUrl);
    const upstream = await fetch(signedUrl);

    if (!upstream.ok) {
      console.error("Cloudinary PDF fetch failed:", upstream.status, await upstream.text().catch(() => ""));
      return NextResponse.json({ error: "Failed to retrieve the quote PDF" }, { status: 502 });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=\"quote.pdf\"",
        "Cache-Control": "private, max-age=0, no-cache",
      },
    });
  } catch (error) {
    console.error("GET /api/orders/[id]/quote-pdf error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
