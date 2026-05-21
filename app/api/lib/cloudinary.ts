import { v2 as cloudinary } from "cloudinary";
import { env } from "./env";
import { logger } from "./logger";

const isCloudinaryConfigured =
  env.cloudinaryCloudName &&
  env.cloudinaryApiKey &&
  env.cloudinaryApiSecret;

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true,
  });
  logger.info("Cloudinary configured", { cloudName: env.cloudinaryCloudName });
} else {
  logger.info("Cloudinary not configured — using local disk storage");
}

export { cloudinary, isCloudinaryConfigured };
