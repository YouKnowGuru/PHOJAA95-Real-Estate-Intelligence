import { createHash } from "crypto";
import { logger } from "../lib/logger";

const CLOUD_NAME = process.env.VITE_CLOUDINARY_CLOUD_NAME || "";
const API_KEY = process.env.CLOUDINARY_API_KEY || "";
const API_SECRET = process.env.CLOUDINARY_API_SECRET || "";

/**
 * Delete an image from Cloudinary by its public_id.
 * Uses the Cloudinary Admin API with SHA-1 signature authentication.
 */
export async function deleteCloudinaryImage(publicId: string): Promise<boolean> {
    if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
        logger.warn("Missing Cloudinary credentials, skipping deletion", { publicId });
        return false;
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHash("sha1")
        .update(`public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`)
        .digest("hex");

    const formData = new URLSearchParams();
    formData.append("public_id", publicId);
    formData.append("timestamp", timestamp);
    formData.append("api_key", API_KEY);
    formData.append("signature", signature);

    try {
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`,
            {
                method: "POST",
                body: formData,
            }
        );

        const result = await response.json() as { result?: string; error?: { message: string } };

        if (result.result === "ok" || result.result === "not found") {
            logger.info("Cloudinary image deleted", { publicId, result: result.result });
            return true;
        }

        logger.error("Cloudinary deletion failed", { publicId, result });
        return false;
    } catch (err) {
        logger.error("Cloudinary deletion error", { publicId, error: String(err) });
        return false;
    }
}

/**
 * Delete multiple Cloudinary images by their public_ids.
 * Returns the count of successfully deleted images.
 */
export async function deleteCloudinaryImages(publicIds: string[]): Promise<number> {
    let deleted = 0;
    for (const publicId of publicIds) {
        if (publicId) {
            const success = await deleteCloudinaryImage(publicId);
            if (success) deleted++;
        }
    }
    return deleted;
}
