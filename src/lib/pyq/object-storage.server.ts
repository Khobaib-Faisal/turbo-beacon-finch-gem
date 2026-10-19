import { createHash, createHmac } from "node:crypto";

const bucket = process.env.NEON_STORAGE_BUCKET || "pyq-question-images";

function config() {
  const endpoint = process.env.AWS_ENDPOINT_URL_S3?.replace(/\/+$/, "");
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || "us-east-2";
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Question image storage is not configured. Add the Neon S3 endpoint and access keys to Vercel, then redeploy.",
    );
  }
  return { endpoint, accessKeyId, secretAccessKey, region };
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

/** Upload a captured question image to the configured Neon S3-compatible bucket. */
export async function storePyqImage(
  key: string,
  dataUrl: string,
): Promise<string> {
  const { endpoint, accessKeyId, secretAccessKey, region } = config();
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("Question image must be a base64 JPEG.");
  const body = Buffer.from(match[1], "base64");
  const path = `/${bucket}/${key}`;
  const url = new URL(`${endpoint}${path}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const payloadHash = sha256(body);
  const headers = [
    "content-type:image/jpeg",
    `host:${url.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join("\n");
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "PUT",
    url.pathname,
    "",
    `${headers}\n`,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const scope = `${date}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256(canonicalRequest),
  ].join("\n");
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${secretAccessKey}`, date), region), "s3"),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "content-type": "image/jpeg",
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body,
  });
  if (!response.ok) {
    throw new Error(`Could not save question image (storage returned ${response.status}).`);
  }
  // The bucket must be configured as public_read in Neon so the question bank
  // can display these non-sensitive public exam images directly.
  return `${endpoint}${path}`;
}

export function pyqImageObjectKey(id: string) {
  return `questions/${id.replace(/[^a-zA-Z0-9_-]/g, "")}.jpg`;
}

export function pyqImageKeyFromExternalKey(externalKey: string) {
  return `imports/${sha256(externalKey)}.jpg`;
}
