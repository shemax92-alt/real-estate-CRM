const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegram(message) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: message,
      parse_mode: 'HTML'
    })
  });
  return resp.json();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Vercel Cron вызывает GET — проверяем Authorization
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    // Разрешаем ручной вызов без токена для тестирования
    if (req.method !== 'GET') return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const now = new Date();
    const in1h = new Date(now.getTime() + 60 * 60 * 1000);    // +1 час
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24 часа

    // Получаем всех клиентов
    const { data: clients, error } = await supabase
      .from('clients')
      .select('*');
    if (error) throw error;

    const messages = [];

    for (const c of clients) {
      // Проверяем встречи в ближайший час
      if (c.meeting) {
        const meetingTime = new Date(c.meeting);
        if (meetingTime >= now && meetingTime <= in1h) {
          messages.push(
            `🤝 <b>Встреча через час!</b>\n` +
            `👤 ${c.name}\n` +
            `📞 ${c.phone || '—'}\n` +
            `🏠 ${c.object || '—'}\n` +
            `🕐 ${meetingTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
          );
        }
        // Напоминание за 24 часа
        if (meetingTime >= in1h && meetingTime <= in24h) {
          const timeStr = meetingTime.toLocaleString('ru-RU', {
            day: '2-digit', month: '2-digit',
            hour: '2-digit', minute: '2-digit'
          });
          messages.push(
            `📅 <b>Встреча завтра</b>\n` +
            `👤 ${c.name}\n` +
            `📞 ${c.phone || '—'}\n` +
            `🏠 ${c.object || '—'}\n` +
            `🕐 ${timeStr}`
          );
        }
      }

      // Проверяем созвон для подтверждения
      if (c.confirm_call) {
        const callTime = new Date(c.confirm_call);
        if (callTime >= now && callTime <= in1h) {
          messages.push(
            `📞 <b>Созвон для подтверждения через час!</b>\n` +
            `👤 ${c.name}\n` +
            `📞 ${c.phone || '—'}\n` +
            `🕐 ${callTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
          );
        }
      }

      // Просроченные задачи
      if (c.tasks) {
        const tasks = typeof c.tasks === 'string' ? JSON.parse(c.tasks) : c.tasks;
        const overdue = tasks.filter(t => !t.done && t.dueDate && new Date(t.dueDate) < now);
        if (overdue.length > 0) {
          messages.push(
            `⚠️ <b>Просроченные задачи</b>\n` +
            `👤 ${c.name}\n` +
            overdue.map(t => `• ${t.type}: ${t.note || '—'}`).join('\n')
          );
        }
      }
    }

    // Утренний дайджест — отправляем в 9:00
    const hour = now.getHours();
    if (hour === 9) {
      const todayStr = now.toISOString().slice(0, 10);
      const todayMeetings = clients.filter(c => c.meeting && c.meeting.startsWith(todayStr));
      if (todayMeetings.length > 0) {
        const digest = todayMeetings.map(c => {
          const t = new Date(c.meeting).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
          return `🕐 ${t} — ${c.name} (${c.phone || '—'})`;
        }).join('\n');
        messages.push(`🌅 <b>Встречи на сегодня:</b>\n${digest}`);
      }

      // Клиенты без контакта
      const needContact = clients.filter(c => {
        const last = c.contacts && c.contacts.length > 0
          ? c.contacts[c.contacts.length - 1]?.date
          : null;
        if (!last) return true;
        const days = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
        if (c.tab === 'Отложенные') return days > 30;
        if (c.tab === 'Активные') return days > 7;
        if (c.tab === 'Сделки') return days > 3;
        return false;
      });
      if (needContact.length > 0) {
        messages.push(
          `🔴 <b>Нужен контакт (${needContact.length} чел.):</b>\n` +
          needContact.slice(0, 5).map(c => `• ${c.name} [${c.tab}]`).join('\n') +
          (needContact.length > 5 ? `\n...и ещё ${needContact.length - 5}` : '')
        );
      }
    }

    // Отправляем все сообщения
    for (const msg of messages) {
      await sendTelegram(msg);
      await new Promise(r => setTimeout(r, 100)); // небольшая пауза между сообщениями
    }

    return res.status(200).json({ sent: messages.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
