import { createHash } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';

const delivery = { resource_type: 'image', type: 'authenticated' };
const namespace = 'acb-moderation-evidence';
const maxBytes = 5 * 1024 * 1024;
const formats = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const providerError = (code, cause) => {
  const status = cause?.http_code || cause?.status;
  return Object.assign(new Error('Cloudinary görsel kanıtı doğrulanamadı.'), {
    status: 502, code: `IMAGE_EVIDENCE_${code}${Number.isInteger(status) ? `_${status}` : ''}`, cause,
  });
};

export async function readImageEvidence(evidence) {
  if (!evidence) return null;
  if (!/^[a-f0-9]{64}$/.test(evidence.sha256) || !/^\d+$/.test(evidence.version) || !formats.has(evidence.format) ||
      !new RegExp(`^${namespace}/[a-f0-9]{24}-${evidence.sha256}$`).test(evidence.publicId)) throw providerError('METADATA');
  try {
    const source = new URL(cloudinary.url(evidence.publicId, {
      ...delivery, format: evidence.format, version: evidence.version, secure: true, sign_url: true,
    }));
    const prefix = `/${cloudinary.config().cloud_name}/image/authenticated/`;
    if (source.origin !== 'https://res.cloudinary.com' || !source.pathname.startsWith(prefix)) throw providerError('SOURCE');
    const response = await fetch(source, { redirect: 'error', signal: AbortSignal.timeout(12000) });
    if (!response.ok || !response.body) throw providerError('DOWNLOAD', response);
    const chunks = [];
    let total = 0;
    for await (const chunk of response.body) {
      total += chunk.length;
      if (total > maxBytes) throw providerError('SIZE');
      chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks, total);
    if (!total || hash(bytes) !== evidence.sha256) throw providerError('HASH');
    return bytes;
  } catch (error) { throw error.code?.startsWith('IMAGE_EVIDENCE_') ? error : providerError('DOWNLOAD', error); }
}

export async function storeImageEvidence(assetId, bytes, { reuseExisting = false } = {}) {
  if (!bytes?.length || bytes.length > maxBytes) throw providerError('SIZE');
  const sha256 = hash(bytes);
  const publicId = `${namespace}/${assetId}-${sha256}`;
  let result;
  try {
    result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ ...delivery, public_id: publicId, overwrite: false, timeout: 15000 },
        (error, value) => error ? reject(error) : resolve(value));
      stream.on('error', reject);
      stream.end(bytes);
    });
  } catch (error) {
    if (!reuseExisting) throw providerError('UPLOAD', error);
    try { result = await cloudinary.api.resource(publicId, delivery); }
    catch { throw providerError('UPLOAD', error); }
  }
  if (result?.public_id !== publicId || result.resource_type !== delivery.resource_type || result.type !== delivery.type) throw providerError('UPLOAD_METADATA');
  const evidence = { publicId, version: String(result.version), format: result.format, sha256 };
  await readImageEvidence(evidence);
  return evidence;
}
