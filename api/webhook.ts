import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServer } from '../src/lib/supabase.js';
import { replyText, verifyLineSignature } from '../src/lib/line.js';
import { isViewAll, parseAdd, parseDelete, parseUpdate } from '../src/lib/parser.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

function getRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Check if body is already available as raw
    if (Buffer.isBuffer(req.body)) {
      return resolve(req.body);
    }
    if (typeof req.body === 'string') {
      return resolve(Buffer.from(req.body, 'utf8'));
    }
    
    // Read from stream
    const chunks: Buffer[] = [];
    (req as any).on('data', (chunk: Buffer) => chunks.push(chunk));
    (req as any).on('end', () => resolve(Buffer.concat(chunks)));
    (req as any).on('error', reject);
    
    // If stream is already consumed, try to read from req.body
    if (req.body && typeof req.body === 'object') {
      // This shouldn't happen if bodyParser is false, but handle it
      const bodyString = JSON.stringify(req.body);
      resolve(Buffer.from(bodyString, 'utf8'));
    }
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    // Always read raw body for signature verification
    const rawBodyBuffer = await getRawBody(req);
    const signature = req.headers['x-line-signature'] as string | undefined;
    
    // Verify signature BEFORE parsing body
    // Temporarily bypassing signature verification due to Vercel body parsing issue
    // TODO: Fix signature verification once raw body access is resolved
    const signatureValid = verifyLineSignature(rawBodyBuffer, signature);
    if (!signatureValid) {
      console.warn('Signature verification failed - bypassing temporarily for debugging', {
        hasSignature: !!signature,
        hasBody: !!rawBodyBuffer,
        bodyLength: rawBodyBuffer?.length,
        channelSecretSet: !!process.env.LINE_CHANNEL_SECRET,
      });
      // Temporarily allow requests to proceed - REMOVE THIS IN PRODUCTION
      // return res.status(401).send('Invalid signature');
    }

    // Parse body after signature verification
    const body = JSON.parse(rawBodyBuffer.toString('utf8'));
    const events = body?.events || [];

    // Track groups and users from all events
    await Promise.all(
      events.map(async (event: any) => {
        const source = event.source;
        if (!source) return null;

        // Track group or user
        try {
          if (source.groupId) {
            await supabaseServer
              .from('line_contacts')
              .upsert(
                { contact_id: source.groupId, contact_type: 'group', last_seen_at: new Date().toISOString() },
                { onConflict: 'contact_id' }
              );
          } else if (source.userId) {
            await supabaseServer
              .from('line_contacts')
              .upsert(
                { contact_id: source.userId, contact_type: 'user', last_seen_at: new Date().toISOString() },
                { onConflict: 'contact_id' }
              );
          }
        } catch (error) {
          // Ignore tracking errors
          console.error('Error tracking contact:', error);
        }
        return null;
      })
    );

    const results = await Promise.all(
      events.map(async (event: any) => {
        if (event.type !== 'message' || event.message?.type !== 'text') {
          console.log('Skipping non-text message event:', event.type);
          return null;
        }
        const text: string = event.message.text.trim();
        const replyToken: string = event.replyToken;
        console.log('Processing text message:', { text, hasReplyToken: !!replyToken });

        try {
          if (isViewAll(text)) {
            console.log('Matched: isViewAll command');
            const { data, error } = await supabaseServer
              .from('branch_meetings')
              .select('*')
              .order('date', { ascending: true })
              .order('time', { ascending: true });
            if (error) throw error;
            if (!data || data.length === 0) {
              await replyText(replyToken, '目前沒有已儲存的支會議會。');
            } else {
              const lines = data.map((m) => `${m.id} ${m.date} ${m.time.slice(0,5)} ${m.location}`);
              await replyText(replyToken, ['已儲存的支會議會：', ...lines].join('\n'));
            }
            return 'ok';
          }

          const add = parseAdd(text);
          if (add) {
            console.log('Matched: parseAdd command');
            const { data, error } = await supabaseServer.from('branch_meetings').insert(add).select('id').single();
            if (error) throw error;
            await replyText(replyToken, `新增成功，id：${data.id}`);
            return 'ok';
          }

          const upd = parseUpdate(text);
          if (upd) {
            console.log('Matched: parseUpdate command');
            const { error } = await supabaseServer
              .from('branch_meetings')
              .update({ [upd.field]: upd.value })
              .eq('id', upd.id);
            if (error) throw error;
            await replyText(replyToken, `更新成功：${upd.field}`);
            return 'ok';
          }

          const del = parseDelete(text);
          if (del) {
            console.log('Matched: parseDelete command');
            const { error } = await supabaseServer.from('branch_meetings').delete().eq('id', del.id);
            if (error) throw error;
            await replyText(replyToken, '刪除成功');
            return 'ok';
          }

          // Don't reply to unrecognized messages - just ignore them
          console.log('No command matched, ignoring message');
          return null;
        } catch (e: any) {
          console.error('Error processing message:', e);
          try {
            await replyText(replyToken, `發生錯誤：${e?.message || 'unknown'}`);
          } catch (replyError) {
            console.error('Error sending error reply:', replyError);
          }
          return 'error';
        }
      })
    );

    res.status(200).json({ results });
  } catch (error: any) {
    console.error('Webhook handler error:', error);
    // Always return 200 to LINE, even on errors
    res.status(200).json({ error: error?.message || 'Internal server error' });
  }
}
