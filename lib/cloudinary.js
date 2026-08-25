import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import { Readable } from "stream";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_DIMENSION = 1600;

/** Downscale/recompress before upload so stored + transferred images stay small. */
async function optimizeImageBuffer(buffer) {
  return sharp(buffer)
    .rotate()
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 82, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

/**
 * Uploads a Base64 image string or file buffer to Cloudinary.
 * Returns the secure HTTPS URL from Cloudinary CDN.
 * If input is already an HTTP/HTTPS URL, returns it unchanged.
 */
export async function uploadImageToCloudinary(imageInput, folder = "materials") {
  if (!imageInput || typeof imageInput !== "string") return null;

  // If already uploaded to Cloudinary or web URL
  if (imageInput.startsWith("http://") || imageInput.startsWith("https://")) {
    return imageInput;
  }

  // Upload base64 image data URL
  if (imageInput.startsWith("data:image")) {
    try {
      const base64Data = imageInput.replace(/^data:image\/[\w.+-]+;base64,/i, "");
      const inputBuffer = Buffer.from(base64Data, "base64");
      const optimizedBuffer = await optimizeImageBuffer(inputBuffer);
      const optimizedDataUrl = `data:image/jpeg;base64,${optimizedBuffer.toString("base64")}`;

      const result = await cloudinary.uploader.upload(optimizedDataUrl, {
        folder: `paperflow/${folder}`,
        resource_type: "image",
      });
      return result.secure_url;
    } catch (error) {
      console.error("Cloudinary upload failed:", error);
      return null;
    }
  }

  return null;
}

/**
 * Uploads a raw PDF buffer to Cloudinary as an *authenticated* (private) asset
 * and returns its public_id — not a directly-browsable URL. Cloudinary's default
 * "restrict media types" account setting blocks delivery of raw/PDF files via the
 * normal public "upload" delivery type (a plain or even sign_url:true "upload"
 * link still 401s), so this stores the file as `type: authenticated` instead —
 * the one delivery mode Cloudinary documents as exempt from that restriction —
 * and callers must use `getSignedPdfDownloadUrl()` to fetch it (see
 * app/api/orders/[id]/quote-pdf/route.js, which proxies the bytes so the
 * browser never needs to know any of this).
 */
export async function uploadPdfToCloudinary(buffer, folder = "quotes") {
  const result = await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: `paperflow/${folder}`, resource_type: "raw", type: "authenticated", format: "pdf" },
      (error, res) => {
        if (error) reject(error);
        else resolve(res);
      },
    );
    const readable = new Readable({
      read() {
        this.push(buffer);
        this.push(null);
      },
    });
    readable.pipe(uploadStream);
  });

  return result.public_id;
}

/** Generates a short-lived signed URL to actually fetch an authenticated PDF's bytes. */
export function getSignedPdfDownloadUrl(publicId) {
  return cloudinary.utils.private_download_url(publicId, "pdf", {
    resource_type: "raw",
    type: "authenticated",
  });
}
