import { v2 as cloudinary } from "cloudinary";
import { STORAGE_CONFIG } from "@/config/site";
import { getStorageEnv } from "@/lib/utils/env";

let configured = false;

function getClient() {
  if (!configured) {
    const env = getStorageEnv();
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

function publicId(path: string): string {
  return `${STORAGE_CONFIG.rawSourcesPrefix}/${path.replace(/^\/+/, "")}`;
}

export async function uploadRawDocument(path: string, file: Buffer): Promise<string> {
  const client = getClient();
  const id = publicId(path);

  const result = await new Promise<{ public_id: string }>((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      { resource_type: "raw", public_id: id, overwrite: true, invalidate: true },
      (error, uploaded) => {
        if (error || !uploaded) reject(error ?? new Error("Cloudinary upload returned no result"));
        else resolve(uploaded);
      },
    );
    stream.end(file);
  });

  return result.public_id;
}

export function getRawDocumentUrl(key: string): string {
  return getClient().url(key, { resource_type: "raw", secure: true });
}

export async function downloadRawDocument(key: string): Promise<Buffer> {
  const response = await fetch(getRawDocumentUrl(key));

  if (!response.ok) {
    throw new Error(`Cloudinary object "${key}" fetch failed: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function deleteRawDocument(key: string): Promise<void> {
  await getClient().uploader.destroy(key, { resource_type: "raw", invalidate: true });
}
