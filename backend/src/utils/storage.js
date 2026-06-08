/**
 * storage.js — image storage utility
 *
 * Priority:
 *  1. Cloudflare R2 (when env vars are set) — returns public CDN URL
 *  2. DB base64 (fallback) — converts buffer to a data: URI so no files
 *     are ever written to disk and no static file server is needed.
 *
 * The "only save image to db" requirement means: when R2 is not configured,
 * store the image as a base64 data URI directly in the photo_url column
 * rather than writing to the uploads/ folder.
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');

const R2_CONFIGURED =
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_PUBLIC_URL;

let s3Client = null;

if (R2_CONFIGURED) {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'auction-platform';
const PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

// Max size for base64 DB storage: 2 MB (keeps rows manageable)
const MAX_BASE64_BYTES = 2 * 1024 * 1024;

/**
 * Upload a file buffer to R2 (production) or encode as base64 data URI (dev).
 * Always returns a URL string — either an R2 CDN URL or a data: URI.
 * Nothing is ever written to the local filesystem.
 */
const uploadFile = async (buffer, mimetype, folder = 'uploads') => {
  // ── R2 path ──────────────────────────────────────────────────────────────
  if (R2_CONFIGURED && s3Client) {
    const rawExt = mimetype.split('/')[1] || 'jpg';
    const extension = rawExt.replace('jpeg', 'jpg');
    const key = `${folder}/${uuidv4()}.${extension}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
        CacheControl: 'public, max-age=31536000',
      })
    );

    return `${PUBLIC_URL}/${key}`;
  }

  // ── Base64 DB path (dev / no R2) ─────────────────────────────────────────
  // Warn if image is very large — it will bloat DB rows.
  if (buffer.length > MAX_BASE64_BYTES) {
    console.warn(
      `[storage] Image too large for DB storage (${(buffer.length / 1024).toFixed(0)} KB > 2 MB). ` +
      `Configure R2 for production use.`
    );
    // Still store it — let the caller decide whether to reject.
  }

  const base64 = buffer.toString('base64');
  const dataUri = `data:${mimetype};base64,${base64}`;
  console.info(`[storage] R2 not configured — storing image as base64 data URI in DB (${(buffer.length / 1024).toFixed(0)} KB)`);
  return dataUri;
};

/**
 * Delete a file from R2 by its public URL.
 * Base64 data URIs don't need deletion (they live in DB rows).
 */
const deleteFile = async (publicUrl) => {
  if (!publicUrl) return;

  // Base64 data URIs are stored in the DB — nothing to delete from disk/R2
  if (publicUrl.startsWith('data:')) return;

  if (!R2_CONFIGURED || !s3Client || !PUBLIC_URL) return;

  const key = publicUrl.replace(`${PUBLIC_URL}/`, '');
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })
  );
};

/**
 * Generate a presigned upload URL (for direct browser uploads).
 * Only available when R2 is configured.
 */
const getPresignedUploadUrl = async (folder, mimetype) => {
  if (!R2_CONFIGURED || !s3Client) {
    throw new Error('R2 storage is not configured');
  }
  const extension = mimetype.split('/')[1] || 'jpg';
  const key = `${folder}/${uuidv4()}.${extension}`;
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: mimetype,
  });
  const url = await getSignedUrl(s3Client, command, { expiresIn: 300 });
  return { url, key, publicUrl: `${PUBLIC_URL}/${key}` };
};

module.exports = { uploadFile, deleteFile, getPresignedUploadUrl };