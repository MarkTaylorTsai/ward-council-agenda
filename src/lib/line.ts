import { Client, ClientConfig, middleware, MiddlewareConfig, SignatureValidationFailed } from '@line/bot-sdk';
import crypto from 'crypto';

const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const channelSecret = process.env.LINE_CHANNEL_SECRET || '';

export const lineClient = new Client({ channelAccessToken: accessToken } as ClientConfig);

export function verifyLineSignature(rawBody: string | Buffer, signatureHeader?: string): boolean {
  if (!channelSecret || !signatureHeader) return false;
  const hmac = crypto.createHmac('sha256', channelSecret);
  const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
  hmac.update(bodyBuffer);
  const digest = hmac.digest('base64');
  
  // Debug logging
  console.log('Signature verification debug:', {
    receivedSignature: signatureHeader,
    computedSignature: digest,
    match: digest === signatureHeader,
    bodyLength: bodyBuffer.length,
    bodyPreview: bodyBuffer.toString('utf8').substring(0, 100),
  });
  
  return digest === signatureHeader;
}

// Create LINE middleware for signature verification
export function createLineMiddleware() {
  return middleware({
    channelSecret,
  } as MiddlewareConfig);
}

export async function replyText(replyToken: string, text: string) {
  await lineClient.replyMessage(replyToken, { type: 'text', text });
}

export async function pushText(targetId: string, text: string) {
  await lineClient.pushMessage(targetId, { type: 'text', text });
}

export async function broadcastText(text: string) {
  await lineClient.broadcast([{ type: 'text', text }]);
}

