const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

async function sendTelegram(message) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: 'HTML' }),
  });
  return resp.json();
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const now     = new Date();
    const in1h    = new Date(now.getTime() + 60 * 60 * 1000);
    const in24h   = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const todayStr = now.toISOString().slice(0, 10);

    const { data: clients, error } = await supabase.from('clients').select('*');
    if (error) throw error;

    const messages = [];

    for (const c of clients) {
      if (c.meeting) {
        const mt = new Date(c.meeting);
        if (mt >= now && mt <= in1h) {
          messages.push(`🤝 <b>Встреча через час!</b>\n👤 ${c.name}\n📞 ${c.phone || '—'}\n🏠 ${c.object || '—'}\n🕐 ${mt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`);
        }
        if (mt >= in1h && mt <= in24h) {
          messages.push(`📅 <b>Встреча завтра</b>\n👤 ${c.name}\n📞 ${c.phone || '—'}\n🏠 ${c.object || '—'}\n🕐 ${mt.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`);
        }
      }
      if (c.confirm_call) {
        const ct = new Date(c.confirm_call);
        if (ct >= now && ct <= in1h) {
          messages.push(`📞 <b>Созвон через час!</b>\n👤 ${c.name}\n📞 ${c.phone || '—'}\n🕐 ${ct.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`);
        }
      }
      const tasks = typeof c.tasks === 'string' ? JSON.parse(c.tasks || '[]') : (c.tasks || []);
      const overdue = tasks.filter(t => !t.done && t.dueDate && t.dueDate < todayStr);
      if (overdue.length > 0) {
        messages.push(`⚠️ <b>Просроченные задачи</b>\n👤 ${c.name}\n` + overdue.map(t => `• ${t.type}${t.note ? ': ' + t.note : ''}`).join('\n'));
      }
    }

    if (now.getHours() === 9) {
      const todayMeetings = clients.filter(c => c.meeting && c.meeting.startsWith(todayStr));
      if (todayMeetings.length > 0) {
        const lines = todayMeetings.map(c => {
          const t = new Date(c.meeting).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
          return `🕐 ${t} — ${c.name} (${c.phone || '—'})`;
        }).join('\n');
        messages.push(`🌅 <b>Встречи на сегодня:</b>\n${lines}`);
      }

      const needContact = clients.filter(c => {
        const contacts = typeof c.contacts === 'string' ? JSON.parse(c.contacts || '[]') : (c.contacts || []);
        const lastDate  = contacts.at(-1)?.date || null;
        const days = lastDate ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000) : null;
        if (c.tab === 'Входящие')   return days === null || days > 2;
        if (c.tab === 'Отложенные') return days === null || days > 30;
        if (c.tab === 'Активные')   return days === null || days > 7;
        if (c.tab === 'Сделки')     return days === null || days > 3;
        return false;
      });
      if (needContact.length > 0) {
        messages.push(`🔴 <b>Нужен контакт (${needContact.length} чел.):</b>\n` + needContact.slice(0, 7).map(c => `• ${c.name} [${c.tab}]`).join('\n'));
      }
    }

    for (const msg of messages) {
      await sendTelegram(msg);
      await new Promise(r => setTimeout(r, 150));
    }

    return { statusCode: 200, headers, body: JSON.stringify({ sent: messages.length }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
