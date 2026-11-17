import { createHash } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

export class MediaStorage {
  constructor({ endpoint, accessKeyId, secretAccessKey, bucket, prefix = 'media' }) {
    this.bucket = bucket;
    this.prefix = prefix.replace(/^\/+|\/+$/g, '');
    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  objectKey(slot, id) {
    return `${this.prefix}/${slot}/${id}`;
  }

  async put(slot, id, body, contentType) {
    const objectKey = this.objectKey(slot, id);
    const sha256 = createHash('sha256').update(body).digest('hex');
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
      Metadata: { sha256 },
    }));
    return { objectKey, sha256 };
  }

  async get(objectKey) {
    return this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }));
  }

  async delete(objectKey) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }));
  }
}

