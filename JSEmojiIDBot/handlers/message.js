import { api, db, InputFile } from 'sdk';
import { users } from 'schema';
import { eq, desc, sql } from 'sdk/db';

const ADMIN_ID = 6162684693;

const BTN_NAME_ID           = 'ID';
const BTN_NAME_BUTTON_CODE  = 'Button Code';
const BTN_NAME_CAPTION_CODE = 'Caption Code';

const EMOJI_WAVE  = `<tg-emoji emoji-id="6079974060907838216">👋</tg-emoji>`;
const EMOJI_CROSS = `<tg-emoji emoji-id="6100670215522094562">❌</tg-emoji>`;

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function col(s, w) {
  return String(s ?? '—').padEnd(w).slice(0, w);
}

async function upsertUser(from) {
  if (!from || from.is_bot) return;
  try {
    await db.insert(users)
      .values({
        userId:       from.id,
        firstName:    from.first_name ?? 'Unknown',
        username:     from.username   ?? null,
        languageCode: from.language_code ?? null,
        isPremium:    from.is_premium ?? false,
        lastActive:   new Date(),
        createdAt:    new Date(),
      })
      .onConflictDoUpdate({
        target: users.userId,
        set: {
          firstName:    from.first_name ?? 'Unknown',
          username:     from.username   ?? null,
          languageCode: from.language_code ?? null,
          isPremium:    from.is_premium ?? false,
          lastActive:   new Date(),
        },
      })
      .run();
  } catch (e) {
    console.error('upsertUser error:', e.message);
  }
}

async function sendStats(chatId) {
  try {
    const totalRow   = await db.get(sql`SELECT COUNT(*) as c FROM users`);
    const premiumRow = await db.get(sql`SELECT COUNT(*) as c FROM users WHERE is_premium = 1`);
    const totalUsers   = totalRow?.c  ?? 0;
    const premiumUsers = premiumRow?.c ?? 0;

    const langRows = await db.all(sql`
      SELECT language_code as lang, COUNT(*) as cnt
      FROM users
      GROUP BY language_code
      ORDER BY cnt DESC
    `);

    const topLangs = langRows.filter(r => r.cnt >= 10).length > 0
      ? langRows.filter(r => r.cnt >= 10)
      : langRows.slice(0, 10);

    const div = '─'.repeat(34);
    let table = `${div}\n`;
    table    += `${col('#', 3)} ${col('Language', 12)} ${col('Users', 6)} ${col('%', 6)}\n`;
    table    += `${div}\n`;
    topLangs.forEach((r, i) => {
      const pct = totalUsers > 0 ? ((r.cnt / totalUsers) * 100).toFixed(1) + '%' : '0%';
      table += `${col(i + 1, 3)} ${col(r.lang ?? 'Unknown', 12)} ${col(r.cnt, 6)} ${col(pct, 6)}\n`;
    });
    table += div;

    const heading = langRows.filter(r => r.cnt >= 10).length > 0
      ? 'Top Languages (≥10 users)'
      : `Top Languages (${topLangs.length} total)`;

    await api.sendMessage({
      chat_id: chatId,
      parse_mode: 'HTML',
      text:
        `📊 <b>Bot Statistics</b>\n\n` +
        `👥 <b>Total Users:</b> <code>${totalUsers}</code>\n` +
        `✨ <b>Premium Users:</b> <code>${premiumUsers}</code>\n` +
        `🌍 <b>Unique Languages:</b> <code>${langRows.length}</code>\n\n` +
        `<b>${heading}:</b>\n<pre>${table}</pre>`,
    });
  } catch (e) {
    console.error('sendStats error:', e.message);
    await api.sendMessage({ chat_id: chatId, text: `⚠️ Stats error: ${esc(e.message)}`, parse_mode: 'HTML' });
  }
}

async function sendExport(chatId) {
  try {
    const allUsers = await db.all(sql`
      SELECT
        user_id       AS userId,
        first_name    AS firstName,
        username,
        language_code AS languageCode,
        is_premium    AS isPremium,
        datetime(last_active,  'unixepoch') AS lastActive,
        datetime(created_at,   'unixepoch') AS createdAt
      FROM users
      ORDER BY last_active DESC
    `);

    if (!allUsers || allUsers.length === 0) {
      await api.sendMessage({
        chat_id: chatId,
        text: `${EMOJI_CROSS} No users in database yet.`,
        parse_mode: 'HTML',
      });
      return;
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      totalUsers: allUsers.length,
      users: allUsers,
    };
    const jsonStr = JSON.stringify(payload, null, 2);
    const bytes   = new TextEncoder().encode(jsonStr);
    const file    = new InputFile(bytes, 'users_export.json', { type: 'application/json' });

    await api.sendDocument({
      chat_id: chatId,
      document: file,
      caption:
        `👥 <b>User Export</b>\n` +
        `📦 Total: <code>${allUsers.length}</code> users\n` +
        `🕐 <code>${new Date().toISOString()}</code>`,
      parse_mode: 'HTML',
    });

  } catch (e) {
    console.error('sendExport error:', e.message);
    await api.sendMessage({
      chat_id: chatId,
      text: `⚠️ Export error: ${esc(e.message)}`,
      parse_mode: 'HTML',
    });
  }
}

export default async function (message) {
  const chatId    = message.chat.id;
  const from      = message.from;
  const replyToId = message.message_id;
  const text      = message.text ?? null;
  const isAdmin   = from?.id === ADMIN_ID;

  await upsertUser(from);

  if (text === '/start' || text === '/test') {
    await api.sendMessage({
      chat_id: chatId,
      parse_mode: 'HTML',
      reply_to_message_id: replyToId,
      text:
        `✨ <b>Custom Emoji ID Bot</b> ✨\n\n` +
        `${EMOJI_WAVE} <b>Welcome, ${esc(from?.first_name ?? 'Friend')}!</b>\n\n` +
        `📌 <b>What I can do:</b>\n` +
        `• Send any message with <b>Premium Custom Emojis</b>\n` +
        `• I'll extract each emoji's <b>ID</b>, <b>Button Code</b> &amp; <b>Caption Code</b>\n\n` +
        `💡 <i>Just forward or type a message with custom emojis!</i>\n\n` +
        `☁️ <i>Hosted on <a href="https://core.telegram.org/bots/serverless">Telegram Serverless</a> • <a href="https://github.com/JSOrganizations/JSEmojiIDBot">Open Source</a></i>`,
    });
    return;
  }

  if (isAdmin) {
    if (text === '/stats') {
      await sendStats(chatId);
      return;
    }
    if (text === '/export') {
      await sendExport(chatId);
      return;
    }
  }

  if (!text) {
    await api.sendMessage({
      chat_id: chatId,
      parse_mode: 'HTML',
      reply_to_message_id: replyToId,
      text: `${EMOJI_CROSS} Please send a <b>text message</b> containing one or more Custom Emojis.`,
    });
    return;
  }

  // ── Collect custom emoji entity IDs ────────────────────────────────────────
  const entities       = message.entities ?? [];
  const customEmojiIds = [];

  for (const entity of entities) {
    if (entity.type === 'custom_emoji') {
      const id = entity.custom_emoji_id;
      if (id && !customEmojiIds.includes(id)) customEmojiIds.push(id);
    }
  }

  // ── Handle Sticker Set Links ───────────────────────────────────────────────
  const stickerSetMatch = text.match(/(?:t\.me\/add(?:stickers|emoji)\/|^\/?pack\s+)([\w_]+)/i);
  if (stickerSetMatch && customEmojiIds.length === 0) {
    const packName = stickerSetMatch[1];
    try {
      const set = await api.getStickerSet({ name: packName });
      if (set.sticker_type !== 'custom_emoji') {
        await api.sendMessage({
          chat_id: chatId,
          reply_to_message_id: replyToId,
          text: `${EMOJI_CROSS} The pack <b>${esc(packName)}</b> is a regular sticker pack, not a Premium Custom Emoji pack.`,
          parse_mode: 'HTML',
        });
        return;
      }

      const emojis = set.stickers.map(s => ({ id: s.custom_emoji_id, emoji: s.emoji ?? '❓' }));
      if (emojis.length === 0) {
        await api.sendMessage({ chat_id: chatId, text: `${EMOJI_CROSS} No custom emojis found in this pack.` });
        return;
      }

      let docText = `✨ Premium Custom Emoji Pack: ${packName}\n📦 Total Emojis: ${emojis.length}\n\n`;
      docText += `========================================\n\n`;
      emojis.forEach((e, i) => {
        docText += `${i + 1}. Emoji: ${e.emoji}\n`;
        docText += `   ID: ${e.id}\n`;
        docText += `   Button Code: "icon_custom_emoji_id": "${e.id}"\n`;
        docText += `   Caption Code: <tg-emoji emoji-id="${e.id}">${e.emoji}</tg-emoji>\n\n`;
      });

      const fileBytes = new TextEncoder().encode(docText);
      const file = new InputFile(fileBytes, `${packName}_emojis.txt`, { type: 'text/plain' });

      await api.sendDocument({
        chat_id: chatId,
        document: file,
        caption: 
          `✨ <b>Pack:</b> <code>${esc(packName)}</code>\n` +
          `📦 <b>Total Emojis:</b> ${emojis.length}\n\n` +
          `<i>All IDs and codes are in the attached text file. Sending inline buttons below...</i>`,
        parse_mode: 'HTML',
        reply_to_message_id: replyToId,
      });

      // Send chunked messages with inline buttons (max 30 emojis per message = 90 buttons)
      const chunkSize = 30;
      for (let i = 0; i < emojis.length; i += chunkSize) {
        const chunk = emojis.slice(i, i + chunkSize);
        let resultText = `✨ <b><u>${esc(packName)}</u></b> (Part ${Math.floor(i / chunkSize) + 1})\n\n`;
        const keyboard = [];

        chunk.forEach((e, index) => {
          const idx = i + index + 1;
          const tgEmojiTag     = `<tg-emoji emoji-id="${e.id}">${e.emoji}</tg-emoji>`;
          const btnCode        = `"icon_custom_emoji_id": "${e.id}"`;
          const captionCode    = `<tg-emoji emoji-id="${e.id}">${e.emoji}</tg-emoji>`;
          const captionCodeEsc = esc(captionCode);

          resultText +=
            `<blockquote>` +
            `<b>${idx}. Custom Emoji</b>\n` +
            `✨ <b>Premium Emoji:</b> ${tgEmojiTag}\n` +
            `🆔 <b>ID:</b> <code>${e.id}</code>\n` +
            `🔘 <b>Use in Button:</b> <code>${esc(btnCode)}</code>\n` +
            `📝 <b>Use in Caption:</b> <code>${captionCodeEsc}</code>` +
            `</blockquote>\n`;

          keyboard.push([
            { text: `${BTN_NAME_ID} #${idx}`,          copy_text: { text: e.id },        style: 'primary', icon_custom_emoji_id: e.id },
            { text: `${BTN_NAME_BUTTON_CODE} #${idx}`,  copy_text: { text: btnCode },     style: 'success', icon_custom_emoji_id: e.id },
            { text: `${BTN_NAME_CAPTION_CODE} #${idx}`, copy_text: { text: captionCode }, style: 'danger',  icon_custom_emoji_id: e.id },
          ]);
        });

        await api.sendMessage({
          chat_id: chatId,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard },
          text: resultText,
        });
      }
      return;

    } catch (e) {
      await api.sendMessage({
        chat_id: chatId,
        reply_to_message_id: replyToId,
        text: `${EMOJI_CROSS} Could not fetch the sticker pack. Please check if the link is valid.`,
        parse_mode: 'HTML',
      });
      return;
    }
  }

  if (customEmojiIds.length === 0) {
    await api.sendMessage({
      chat_id: chatId,
      parse_mode: 'HTML',
      reply_to_message_id: replyToId,
      text:
        `${EMOJI_CROSS} No <b>Custom Emojis</b> found in your message.\n\n` +
        `Please send a message containing premium custom emojis.`,
    });
    return;
  }

  try {
    let stickers = null;
    try {
      stickers = await api.getCustomEmojiStickers({ custom_emoji_ids: customEmojiIds });
    } catch (_) {}

    const list = (stickers?.length > 0)
      ? stickers.map((s, i) => ({ id: s.custom_emoji_id ?? customEmojiIds[i], emoji: s.emoji ?? '❓' }))
      : customEmojiIds.map(id => ({ id, emoji: '❓' }));

    let resultText = '✨ <b><u>Custom Emoji List</u></b> ✨\n\n';
    const keyboard = [];

    list.forEach(({ id, emoji }, i) => {
      const idx = i + 1;

      const tgEmojiTag     = `<tg-emoji emoji-id="${id}">${emoji}</tg-emoji>`;
      const btnCode        = `"icon_custom_emoji_id": "${id}"`;
      const captionCode    = `<tg-emoji emoji-id="${id}">${emoji}</tg-emoji>`;
      const captionCodeEsc = esc(captionCode);

      resultText +=
        `<blockquote>` +
        `<b>${idx}. Custom Emoji</b>\n` +
        `✨ <b>Premium Emoji:</b> ${tgEmojiTag}\n` +
        `🆔 <b>ID:</b> <code>${id}</code>\n` +
        `🔘 <b>Use in Button:</b> <code>${esc(btnCode)}</code>\n` +
        `📝 <b>Use in Caption:</b> <code>${captionCodeEsc}</code>` +
        `</blockquote>\n`;

      keyboard.push([
        { text: `${BTN_NAME_ID} #${idx}`,          copy_text: { text: id },          style: 'primary', icon_custom_emoji_id: id },
        { text: `${BTN_NAME_BUTTON_CODE} #${idx}`,  copy_text: { text: btnCode },     style: 'success', icon_custom_emoji_id: id },
        { text: `${BTN_NAME_CAPTION_CODE} #${idx}`, copy_text: { text: captionCode }, style: 'danger',  icon_custom_emoji_id: id },
      ]);
    });

    await api.sendMessage({
      chat_id: chatId,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard },
      reply_to_message_id: replyToId,
      text: resultText,
    });

  } catch (e) {
    console.error('emoji handler error:', e.message);
    try {
      await api.sendMessage({
        chat_id: ADMIN_ID,
        parse_mode: 'HTML',
        text: `⚠️ <b>Bot Error</b>\nUser: <code>${from?.id}</code>\n<code>${esc(e.message ?? String(e))}</code>`,
      });
    } catch (_) {}
    await api.sendMessage({
      chat_id: chatId,
      reply_to_message_id: replyToId,
      text: `${EMOJI_CROSS} An error occurred while processing the custom emojis.`,
      parse_mode: 'HTML',
    });
  }
}
