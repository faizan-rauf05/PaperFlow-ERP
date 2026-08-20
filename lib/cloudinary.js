import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";

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
