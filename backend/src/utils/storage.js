const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

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

// Local uploads directory for dev mode
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const LOCAL_PUBLIC_PATH = '/uploads'; // served by express static

// FIX: Backend base URL so images resolve cross-origin when R2 not configured.
// Set BACKEND_URL in .env e.g. http://localhost:3001 or https://api.yoursite.com
const BACKEND_URL = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, '');

/**
 * Ensure local uploads dir exists
 */
const ensureLocalDir = (folder) => {
  const dir = path.join(LOCAL_UPLOADS_DIR, folder);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

/**
 * Upload a file buffer to R2 (or local disk in dev).
 * Always returns an ABSOLUTE URL so images work from any frontend origin.
 */
const uploadFile = async (buffer, mimetype, folder = 'uploads') => {
  // Local fallback when R2 is not configured
  if (!R2_CONFIGURED || !s3Client) {
    try {
      // Normalise extension — e.g. "image/jpeg" → "jpg", "image/heic" → "heic"
      const rawExt = mimetype.split('/')[1] || 'jpg';
      const extension = rawExt.replace('jpeg', 'jpg');
      const filename = `${uuidv4()}.${extension}`;
      const dir = ensureLocalDir(folder);
      const filepath = path.join(dir, filename);
      fs.writeFileSync(filepath, buffer);
      // FIX: return absolute URL so the frontend can use it cross-origin
      const absoluteUrl = `${BACKEND_URL}${LOCAL_PUBLIC_PATH}/${folder}/${filename}`;
      console.info(`[storage] R2 not configured — saved locally: ${absoluteUrl}`);
      return absoluteUrl;
    } catch (err) {
      console.error('[storage] Local save failed:', err);
      return null;
    }
  }

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
};

/**
 * Delete a file from R2 (or local disk in dev) by its public URL.
 */
const deleteFile = async (publicUrl) => {
  if (!publicUrl) return;

  // Local file — handle both old relative paths and new absolute paths
  const localRelative = `${BACKEND_URL}${LOCAL_PUBLIC_PATH}`;
  if (publicUrl.startsWith(localRelative) || publicUrl.startsWith(LOCAL_PUBLIC_PATH)) {
    try {
      const relativePath = publicUrl
        .replace(localRelative, '')
        .replace(LOCAL_PUBLIC_PATH, '');
      const filepath = path.join(LOCAL_UPLOADS_DIR, relativePath);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    } catch (err) {
      console.error('[storage] Local delete failed:', err);
    }
    return;
  }

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
 * Throws if R2 is not configured.
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