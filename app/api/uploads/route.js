import { NextResponse } from "next/server";
import { Readable } from "stream";
import { Buffer } from "buffer";
import { v2 as cloudinary } from "cloudinary";
import { requireAuth } from "@/lib/apiAuth";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Only JPEG, PNG, or WebP images allowed" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: "File must be under 2MB" }, { status: 400 });
    }

    // Upload to Cloudinary using a stream
    const uploadPromise = new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream({ folder: "uploads" }, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
      const readable = new Readable({
        read() {
          this.push(buffer);
          this.push(null);
        },
      });
      readable.pipe(uploadStream);
    });

    const result = await uploadPromise;
    return NextResponse.json({ photoUrl: result.secure_url });
  } catch (error) {
    console.error("POST /api/uploads error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
