import type { NewsroomEdition, WebhookChannelsStatus } from '../src/types/news.ts';
import { recordApiCall } from './apiQuotaTracker.ts';

interface WebhookRuntimeConfig {
  telegramBotToken: string;
  telegramChatId: string;
  larkWebhookUrl: string;
  autoSendEnabled: boolean;
  lastMorningDeliveryAt: string | null;
  lastAfternoonDeliveryAt: string | null;
  lastDeliverySummary: string | null;
}

const config: WebhookRuntimeConfig = {
  telegramBotToken: (process.env.TELEGRAM_BOT_TOKEN || '').trim(),
  telegramChatId: (process.env.TELEGRAM_CHAT_ID || '').trim(),
  larkWebhookUrl: (
    process.env.LARK_WEBHOOK_URL ||
    process.env.FINANCE_WEBHOOK_URL ||
    ''
  ).trim(),
  autoSendEnabled: true,
  lastMorningDeliveryAt: null,
  lastAfternoonDeliveryAt: null,
  lastDeliverySummary: null,
};

function maskSecret(val: string, head = 4, tail = 4): string {
  if (!val) return '';
  if (val.length <= head + tail + 2) return `${val.slice(0, 2)}••••`;
  return `${val.slice(0, head)}••••${val.slice(-tail)}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function getWebhookChannelsStatus(): WebhookChannelsStatus {
  return {
    telegramConfigured: Boolean(config.telegramBotToken && config.telegramChatId),
    telegramBotTokenMasked: maskSecret(config.telegramBotToken, 6, 4),
    telegramChatIdMasked: maskSecret(config.telegramChatId, 3, 3),
    larkConfigured: Boolean(config.larkWebhookUrl),
    larkWebhookUrlMasked: maskSecret(config.larkWebhookUrl, 34, 8),
    autoSendEnabled: config.autoSendEnabled,
    morningScheduleTime: '08:00',
    afternoonScheduleTime: '17:00',
    timezone: 'Asia/Ho_Chi_Minh',
    lastMorningDeliveryAt: config.lastMorningDeliveryAt,
    lastAfternoonDeliveryAt: config.lastAfternoonDeliveryAt,
    lastDeliverySummary: config.lastDeliverySummary,
  };
}

export function updateWebhookChannelsConfig(params: {
  telegramBotToken?: string;
  telegramChatId?: string;
  larkWebhookUrl?: string;
  autoSendEnabled?: boolean;
  clearTelegram?: boolean;
  clearLark?: boolean;
}): WebhookChannelsStatus {
  if (params.clearTelegram) {
    config.telegramBotToken = '';
    config.telegramChatId = '';
  } else {
    if (typeof params.telegramBotToken === 'string' && params.telegramBotToken.trim()) {
      config.telegramBotToken = params.telegramBotToken.trim();
    }
    if (typeof params.telegramChatId === 'string' && params.telegramChatId.trim()) {
      config.telegramChatId = params.telegramChatId.trim();
    }
  }

  if (params.clearLark) {
    config.larkWebhookUrl = '';
  } else if (typeof params.larkWebhookUrl === 'string') {
    const trimmed = params.larkWebhookUrl.trim();
    if (trimmed === '' || /^https?:\/\//i.test(trimmed)) {
      config.larkWebhookUrl = trimmed;
    }
  }

  if (typeof params.autoSendEnabled === 'boolean') {
    config.autoSendEnabled = params.autoSendEnabled;
  }

  return getWebhookChannelsStatus();
}

export function formatEditionTelegramHtml(edition: NewsroomEdition): string {
  const icon = edition.editionType === 'morning' ? '☀️' : '🌆';
  const lines: string[] = [
    `${icon} <b>LĂNG KÍNH — ${escapeHtml(edition.editionLabel.toUpperCase())}</b>`,
    `<i>Khung tổng hợp: ${escapeHtml(edition.windowLabel)}</i>`,
    '',
    '📌 <b>ĐIỂM NHẤN ĐIỀU HÀNH:</b>',
    ...edition.executiveHighlights
      .slice(0, 3)
      .map((h) => `• ${escapeHtml(h)}`),
    '',
    `📊 <b>Chứng khoán:</b> ${escapeHtml(edition.quickMetrics.vnIndexText)}`,
    `💼 <b>Watchlist:</b> ${escapeHtml(edition.quickMetrics.watchlistHighlight)}`,
    `🔥 <b>Mạng xã hội #1:</b> ${escapeHtml(edition.quickMetrics.topSocialTrend)}`,
    '',
    '📰 <b>TOP 10 TIN QUAN TRỌNG NHẤT:</b>',
  ];

  for (const s of edition.stories.slice(0, 10)) {
    const rankStr = String(s.rank).padStart(2, '0');
    const safeUrl = s.url.replace(/"/g, '%22');
    lines.push(
      `<b>${rankStr}.</b> <a href="${safeUrl}">${escapeHtml(s.title)}</a> — <i>${escapeHtml(s.sourceName)}</i> [${escapeHtml(s.region)}]`
    );
    if (s.oneLineSummary) {
      lines.push(`    ↳ ${escapeHtml(s.oneLineSummary)}`);
    }
  }

  return lines.join('\n').slice(0, 3950);
}

export function buildLarkEditionCardPayload(edition: NewsroomEdition) {
  const isMorning = edition.editionType === 'morning';
  const topHighlightLines = edition.executiveHighlights
    .slice(0, 3)
    .map((h) => `• ${h}`)
    .join('\n');

  const topListMd = edition.stories
    .slice(0, 10)
    .map(
      (s) =>
        `**${String(s.rank).padStart(2, '0')}. [${s.title}](${s.url})** — *${s.sourceName}* (${s.region})\n${s.oneLineSummary}`
    )
    .join('\n\n');

  const topActions = edition.stories.slice(0, 3).map((s) => ({
    tag: 'button',
    text: {
      tag: 'plain_text',
      content: `Mở bài gốc #${s.rank}`,
    },
    type: s.rank === 1 ? 'primary' : 'default',
    url: s.url,
  }));

  return {
    msg_type: 'interactive',
    card: {
      config: {
        wide_screen_mode: true,
      },
      header: {
        template: isMorning ? 'orange' : 'blue',
        title: {
          tag: 'plain_text',
          content: `Lăng Kính · ${edition.editionLabel} (${edition.dateStr.split('-').reverse().join('/')})`,
        },
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**Khung thời gian:** ${edition.windowLabel}\n\n**Điểm nhấn điều hành:**\n${topHighlightLines}`,
          },
        },
        {
          tag: 'hr',
        },
        {
          tag: 'div',
          fields: [
            {
              is_short: true,
              text: {
                tag: 'lark_md',
                content: `**VN-Index:**\n${edition.quickMetrics.vnIndexText}`,
              },
            },
            {
              is_short: true,
              text: {
                tag: 'lark_md',
                content: `**Mạng xã hội #1:**\n${edition.quickMetrics.topSocialTrend}`,
              },
            },
          ],
        },
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**Watchlist nổi bật:** ${edition.quickMetrics.watchlistHighlight}`,
          },
        },
        {
          tag: 'hr',
        },
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: topListMd,
          },
        },
        ...(topActions.length > 0
          ? [
              {
                tag: 'action',
                actions: topActions,
              },
            ]
          : []),
      ],
    },
  };
}

async function sendTelegramHtml(html: string, endpointLabel: string): Promise<{
  ok: boolean;
  message: string;
}> {
  if (!config.telegramBotToken || !config.telegramChatId) {
    return { ok: false, message: 'Chưa cấu hình Telegram Bot Token hoặc Chat ID.' };
  }
  const url = `https://api.telegram.org/bot${encodeURIComponent(config.telegramBotToken)}/sendMessage`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.telegramChatId,
        text: html,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const bodyText = await res.text().catch(() => '');
    recordApiCall({
      apiId: 'webhook',
      endpoint: `Telegram (${endpointLabel})`,
      statusCode: res.status,
      ok: res.ok,
      latencyMs: Date.now() - start,
    });
    if (!res.ok) {
      return {
        ok: false,
        message: `Telegram trả lỗi HTTP ${res.status}: ${bodyText.slice(0, 140)}`,
      };
    }
    return { ok: true, message: 'Đã gửi qua Telegram Bot thành công.' };
  } catch (err) {
    recordApiCall({
      apiId: 'webhook',
      endpoint: `Telegram (${endpointLabel})`,
      statusCode: 500,
      ok: false,
      latencyMs: Date.now() - start,
    });
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Lỗi kết nối Telegram API.',
    };
  }
}

async function sendLarkPayload(payload: unknown, endpointLabel: string): Promise<{
  ok: boolean;
  message: string;
}> {
  if (!config.larkWebhookUrl) {
    return { ok: false, message: 'Chưa cấu hình Lark Webhook URL.' };
  }
  const start = Date.now();
  try {
    const res = await fetch(config.larkWebhookUrl, {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as {
      code?: number;
      StatusCode?: number;
      msg?: string;
    };
    const larkOk =
      res.ok &&
      (json.code === undefined || json.code === 0) &&
      (json.StatusCode === undefined || json.StatusCode === 0);

    recordApiCall({
      apiId: 'webhook',
      endpoint: `Lark Card (${endpointLabel})`,
      statusCode: res.status,
      ok: larkOk,
      latencyMs: Date.now() - start,
    });

    if (!larkOk) {
      return {
        ok: false,
        message: `Lark từ chối (${res.status}): ${json.msg || 'Kiểm tra lại Webhook URL.'}`,
      };
    }
    return { ok: true, message: 'Đã gửi Lark Interactive Card thành công.' };
  } catch (err) {
    recordApiCall({
      apiId: 'webhook',
      endpoint: `Lark Card (${endpointLabel})`,
      statusCode: 500,
      ok: false,
      latencyMs: Date.now() - start,
    });
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Lỗi kết nối Lark Webhook.',
    };
  }
}

export async function sendEditionToTelegramAndLark(
  edition: NewsroomEdition,
  channels: Array<'telegram' | 'lark'> = ['telegram', 'lark']
): Promise<{
  telegram: { attempted: boolean; ok: boolean; message: string };
  lark: { attempted: boolean; ok: boolean; message: string };
  status: WebhookChannelsStatus;
}> {
  const wantTg = channels.includes('telegram') && Boolean(config.telegramBotToken && config.telegramChatId);
  const wantLark = channels.includes('lark') && Boolean(config.larkWebhookUrl);

  const [tgRes, larkRes] = await Promise.all([
    wantTg
      ? sendTelegramHtml(formatEditionTelegramHtml(edition), edition.editionType)
      : Promise.resolve({ ok: false, message: 'Chưa cấu hình Telegram.' }),
    wantLark
      ? sendLarkPayload(buildLarkEditionCardPayload(edition), edition.editionType)
      : Promise.resolve({ ok: false, message: 'Chưa cấu hình Lark Webhook.' }),
  ]);

  const nowIso = new Date().toISOString();
  if (tgRes.ok || larkRes.ok) {
    if (edition.editionType === 'morning') config.lastMorningDeliveryAt = nowIso;
    else config.lastAfternoonDeliveryAt = nowIso;
  }

  const summaryParts: string[] = [];
  if (wantTg) summaryParts.push(`Telegram: ${tgRes.ok ? 'OK' : tgRes.message}`);
  if (wantLark) summaryParts.push(`Lark: ${larkRes.ok ? 'OK' : larkRes.message}`);
  config.lastDeliverySummary =
    summaryParts.length > 0 ? summaryParts.join(' · ') : 'Chưa có kênh nào được cấu hình.';

  return {
    telegram: { attempted: wantTg, ok: tgRes.ok, message: tgRes.message },
    lark: { attempted: wantLark, ok: larkRes.ok, message: larkRes.message },
    status: getWebhookChannelsStatus(),
  };
}

export async function sendTestWebhookMessage(
  channels: Array<'telegram' | 'lark'> = ['telegram', 'lark']
): Promise<{
  telegram: { attempted: boolean; ok: boolean; message: string };
  lark: { attempted: boolean; ok: boolean; message: string };
  status: WebhookChannelsStatus;
}> {
  const nowStr = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date());

  const wantTg = channels.includes('telegram') && Boolean(config.telegramBotToken && config.telegramChatId);
  const wantLark = channels.includes('lark') && Boolean(config.larkWebhookUrl);

  const tgPromise = wantTg
    ? sendTelegramHtml(
        `✅ <b>Lăng Kính — Kiểm tra kết nối Bot thành công</b>\nThời gian: <i>${escapeHtml(nowStr)} (GMT+7)</i>\nHệ thống sẽ tự động gửi Ấn bản Sáng (08:00) &amp; Ấn bản Chiều (17:00) khi bật lịch tự động.`,
        'test'
      )
    : Promise.resolve({ ok: false, message: 'Chưa nhập đủ Bot Token & Chat ID.' });

  const larkPromise = wantLark
    ? sendLarkPayload(
        {
          msg_type: 'interactive',
          card: {
            header: {
              template: 'green',
              title: {
                tag: 'plain_text',
                content: 'Lăng Kính · Kiểm tra kết nối Lark Bot thành công',
              },
            },
            elements: [
              {
                tag: 'div',
                text: {
                  tag: 'lark_md',
                  content: `Thời gian kiểm tra: **${nowStr} (GMT+7)**\nKênh đã sẵn sàng nhận **Ấn bản Sáng (08:00)** và **Ấn bản Chiều (17:00)** cùng Top 10 tin quan trọng nhất.`,
                },
              },
            ],
          },
        },
        'test'
      )
    : Promise.resolve({ ok: false, message: 'Chưa nhập Lark Webhook URL.' });

  const [telegram, lark] = await Promise.all([tgPromise, larkPromise]);

  const parts: string[] = [];
  if (wantTg) parts.push(`Telegram: ${telegram.ok ? 'Thành công' : telegram.message}`);
  if (wantLark) parts.push(`Lark: ${lark.ok ? 'Thành công' : lark.message}`);
  config.lastDeliverySummary = parts.join(' · ') || 'Chưa cấu hình kênh nào để kiểm tra.';

  return {
    telegram: { attempted: wantTg, ok: telegram.ok, message: telegram.message },
    lark: { attempted: wantLark, ok: lark.ok, message: lark.message },
    status: getWebhookChannelsStatus(),
  };
}

const recentAlertUrlSet = new Set<string>();

export async function sendWatchlistNegativeWebhookAlert(params: {
  symbols: string[];
  title: string;
  sourceName: string;
  url: string;
  summary: string;
}): Promise<void> {
  const dedupKey = `${params.symbols.join(',')}::${params.url}`;
  if (recentAlertUrlSet.has(dedupKey)) return;
  recentAlertUrlSet.add(dedupKey);
  if (recentAlertUrlSet.size > 200) {
    const first = recentAlertUrlSet.values().next().value;
    if (first) recentAlertUrlSet.delete(first);
  }

  const wantTg = Boolean(config.telegramBotToken && config.telegramChatId);
  const wantLark = Boolean(config.larkWebhookUrl);
  if (!wantTg && !wantLark) return;

  const symStr = params.symbols.join(', ') || 'Watchlist';
  const safeUrl = params.url.replace(/"/g, '%22');

  const tasks: Array<Promise<unknown>> = [];
  if (wantTg) {
    const html = [
      `🚨 <b>CẢNH BÁO TIN TIÊU CỰC WATCHLIST [${escapeHtml(symStr)}]</b>`,
      `<a href="${safeUrl}">${escapeHtml(params.title)}</a>`,
      `<i>Nguồn: ${escapeHtml(params.sourceName)}</i>`,
      escapeHtml(params.summary.slice(0, 220)),
    ].join('\n');
    tasks.push(sendTelegramHtml(html, `rule-alert-${symStr}`));
  }

  if (wantLark) {
    tasks.push(
      sendLarkPayload(
        {
          msg_type: 'interactive',
          card: {
            header: {
              template: 'red',
              title: {
                tag: 'plain_text',
                content: `Cảnh báo Tin Tiêu cực · ${symStr}`,
              },
            },
            elements: [
              {
                tag: 'div',
                text: {
                  tag: 'lark_md',
                  content: `**[${params.title}](${params.url})**\nNguồn: *${params.sourceName}*\n${params.summary.slice(0, 240)}`,
                },
              },
            ],
          },
        },
        `rule-alert-${symStr}`
      )
    );
  }

  await Promise.allSettled(tasks);
}

