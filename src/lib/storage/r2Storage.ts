import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { STORAGE_CONFIG } from "@/config/site";
import { getStorageEnv } from "@/lib/utils/env";

let client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!client) {
    const env = getStorageEnv();
    client = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

function objectKey(path: string): string {
  return `${STORAGE_CONFIG.rawSourcesPrefix}/${path.replace(/^\/+/, "")}`;
}

export async function uploadRawDocument(
  path: string,
  file: Buffer,
  contentType: string,
): Promise<string> {
  const key = objectKey(path);

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getStorageEnv().R2_BUCKET,
      Key: key,
      Body: file,
      ContentType: contentType,
    }),
  );

  return key;
}

export async function downloadRawDocument(key: string): Promise<Buffer> {
  const response = await getR2Client().send(
    new GetObjectCommand({ Bucket: getStorageEnv().R2_BUCKET, Key: key }),
  );

  if (!response.Body) {
    throw new Error(`R2 object "${key}" has no body.`);
  }

  return Buffer.from(await response.Body.transformToByteArray());
}

export function getRawDocumentUrl(key: string): string {
  const base = getStorageEnv().R2_PUBLIC_BASE_URL;

  if (!base) {
    throw new Error("R2_PUBLIC_BASE_URL is not set — raw source files have no public URL.");
  }

  return `${base.replace(/\/+$/, "")}/${key}`;
}
