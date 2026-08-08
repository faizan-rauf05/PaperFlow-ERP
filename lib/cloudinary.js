import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
      const result = await cloudinary.uploader.upload(imageInput, {
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
