import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { env } from '../config/env.js';

/**
 * AWS S3 service — stores original PDF binaries.
 * Only metadata lives in MongoDB; never the file itself.
 */
const s3 = new S3Client({
  region: env.aws.region,
  credentials: {
    accessKeyId: env.aws.accessKeyId,
    secretAccessKey: env.aws.secretAccessKey,
  },
});

/** Sanitize a filename for use inside an S3 key. */
function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
}

/**
 * Upload a PDF buffer. Keys are namespaced per user:
 *   pdfs/<userId>/<uuid>-<sanitized-name>.pdf
 */
export async function uploadToS3({ userId, originalName, buffer }) {
  const key = `pdfs/${userId}/${randomUUID()}-${sanitizeFilename(originalName)}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: env.aws.bucketName,
      Key: key,
      Body: buffer,
      ContentType: 'application/pdf',
    })
  );

  return key;
}

/** Delete a PDF object from S3. */
export async function deleteFromS3(key) {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: env.aws.bucketName,
      Key: key,
    })
  );
}
