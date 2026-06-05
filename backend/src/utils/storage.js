const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'auction-platform';
const PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

/**
 * Upload a file buffer to R2
 * @param {Buffer} buffer - File buffer
 * @param {string} mimetype - File mime type
 * @param {string} folder - Destination folder (players, teams, etc.)
 * @returns {Promise<string>} Public URL of uploaded file
 */
const uploadFile = async (buffer, mimetype, folder = 'uploads') => {
  const extension = mimetype.split('/')[1] || 'jpg';
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
 * Delete a file from R2 by its public URL
 * @param {string} publicUrl - Public URL of the file
 */
const deleteFile = async (publicUrl) => {
  if (!publicUrl || !PUBLIC_URL) return;
  const key = publicUrl.replace(`${PUBLIC_URL}/`, '');
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })
  );
};

/**
 * Generate a presigned upload URL (for direct browser uploads)
 */
const getPresignedUploadUrl = async (folder, mimetype) => {
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
