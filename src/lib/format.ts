import type { BranchMeeting } from './supabase.js';

export function formatMeeting(m: BranchMeeting): string {
  const time = m.time.slice(0, 5);
  return [
    '🕊️ 支會議會 議程',
    '',
    `📅 日期：${m.date}　🕒 時間：${time}　📍 地點：${m.location}`,
    `主持人：${m.host}　　　記錄人：${m.recorder}`,
    `本次會議目的說明：${m.purpose}`,
    '',
    '一、開會',
    `開會祈禱：${m.opening_prayer}`,
    '',
    '二、上次會議事項追蹤',
    ...(m.follow_up_items 
      ? m.follow_up_items.split('\n').filter(line => line.trim())
      : ['1.', '2.']),
    '',
    '三、各組織報告',
    '初級會:',
    '男青年:',
    '女青年:',
    '長定組:',
    '慈助會:',
    '傳道組:',
    '',
    '四、討論主題',
    ...(m.discussion_topics 
      ? m.discussion_topics.split('\n').filter(line => line.trim())
      : ['1.', '2.']),
    '',
    '五、結束',
    `閉會祈禱：${m.closing_prayer}`,
  ].join('\n');
}

export function formatReminder(list: BranchMeeting[]): string {
  if (!list.length) {
    return '📅 本週支會議會提醒\n\n✅ 本週無支會議會安排。';
  }

  const header = `📅 本週支會議會提醒\n\n找到 ${list.length} 個會議：\n`;
  
  const meetings = list.map((m, index) => {
    const meetingNumber = list.length > 1 ? `📌 會議 ${index + 1}/${list.length}\n\n` : '';
    return meetingNumber + formatMeeting(m);
  });

  return header + meetings.join('\n\n' + '─'.repeat(20) + '\n\n');
}

