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
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    // Get raw body - check if it's already available or read from stream
    let rawBodyBuffer: Buffer;
    if (Buffer.isBuffer(req.body)) {
      rawBodyBuffer = req.body;
    } else if (typeof req.body === 'string') {
      rawBodyBuffer = Buffer.from(req.body, 'utf8');
    } else {
      // Read from stream if bodyParser is disabled
      rawBodyBuffer = await getRawBody(req);
    }
    
    const signature = req.headers['x-line-signature'] as string | undefined;
    
    // Verify signature with detailed logging
    if (!verifyLineSignature(rawBodyBuffer, signature)) {
      console.error('Signature verification failed.', {
        hasSignature: !!signature,
        hasBody: !!rawBodyBuffer,
        bodyLength: rawBodyBuffer?.length,
        channelSecretSet: !!process.env.LINE_CHANNEL_SECRET,
      });
      return res.status(401).send('Invalid signature');
    }

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
        if (event.type !== 'message' || event.message?.type !== 'text') return null;
        const text: string = event.message.text.trim();
        const replyToken: string = event.replyToken;

        try {
          if (isViewAll(text)) {
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
            const { data, error } = await supabaseServer.from('branch_meetings').insert(add).select('id').single();
            if (error) throw error;
            await replyText(replyToken, `新增成功，id：${data.id}`);
            return 'ok';
          }

          const upd = parseUpdate(text);
          if (upd) {
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
            const { error } = await supabaseServer.from('branch_meetings').delete().eq('id', del.id);
            if (error) throw error;
            await replyText(replyToken, '刪除成功');
            return 'ok';
          }

          await replyText(
            replyToken,
            '指令無法辨識。請使用：\n查看支會議會 全部\n新增支會議會 {日期 時間 地點 主持人 記錄人 目的 開會祈禱 閉會祈禱}\n更新支會議會 {id 項目 新內容}\n刪除支會議會 {id}'
          );
          return 'ok';
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
