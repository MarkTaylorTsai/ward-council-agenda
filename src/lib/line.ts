import { Client, ClientConfig, middleware, MiddlewareConfig, SignatureValidationFailed } from '@line/bot-sdk';
import crypto from 'crypto';

const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const channelSecret = process.env.LINE_CHANNEL_SECRET || '';

export const lineClient = new Client({ channelAccessToken: accessToken } as ClientConfig);

export function verifyLineSignature(rawBody: string, signatureHeader?: string): boolean {
  if (!channelSecret || !signatureHeader) return false;
  const hmac = crypto.createHmac('sha256', channelSecret);
  hmac.update(rawBody);
  const digest = hmac.digest('base64');
  return digest === signatureHeader;
}

export async function replyText(replyToken: string, text: string) {
  await lineClient.replyMessage(replyToken, { type: 'text', text });
}

export async function pushText(targetId: string, text: string) {
  await lineClient.pushMessage(targetId, { type: 'text', text });
}

export async function broadcastText(text: string) {
  await lineClient.broadcast({ messages: [{ type: 'text', text }] });
}

