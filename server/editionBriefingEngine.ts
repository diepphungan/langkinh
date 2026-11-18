import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  EditionRankedStory,
  EditionType,
  NewsroomEdition,
} from '../src/types/news.ts';
import { isApiInCooldown, recordApiCall } from './apiQuotaTracker.ts';
import {
  ensureNewsroomBootstrapped,
  getEditionCandidates,
  getVnClockNow,
  toVnDateString,
} from './newsroomPublisherBot.ts';
import { getMarketIndices } from './ssiMarketService.ts';
import { fetchSocialTrendsFeed } from './socialTrendsEngine.ts';
import {
  getWebhookChannelsStatus,
  sendEditionToTelegramAndLark,
} from './webhookNotifier.ts';

const MODEL_NAME = 'gemini-4-hydrogen';

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`GEMINI_TIMEOUT_${label}`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const editionCache = new Map<string, NewsroomEdition>();
const autoSentRegistry = new Set<string>();
let schedulerTimer: ReturnType<typeof setInterval> | null = null;

function getAiClientOrNull(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function generateNewsroomEdition(params: {
  dateStr?: string;
  editionType: EditionType;
  watchlistSymbols?: string[];
  forceRefresh?: boolean;
  bootstrapScan?: () => Promise<void>;
}): Promise<NewsroomEdition> {
  const dateStr =
    params.dateStr && /^\d{4}-\d{2}-\d{2}$/.test(params.dateStr)
      ? params.dateStr
      : toVnDateString();
  const editionType: EditionType =
    params.editionType === 'afternoon' ? 'afternoon' : 'morning';
  const editionKey = `${dateStr}_${editionType}`;

  if (!params.forceRefresh && editionCache.has(editionKey)) {
    return editionCache.get(editionKey)!;
  }

  await ensureNewsroomBootstrapped(params.bootstrapScan);

  const [indicesRes, socialRes] = await Promise.all([
    getMarketIndices().catch(() => ({
      indices: [],
      sourceMode: 'fallback' as const,
    })),
    fetchSocialTrendsFeed(false).catch(() => ({
      fetchedAt: new Date().toISOString(),
      trends: [],
      streamsStatus: [],
    })),
  ]);

  const { windowLabel, candidates, totalReviewed } = getEditionCandidates({
    dateStr,
    editionType,
    watchlistSymbols: params.watchlistSymbols,
  });

  const vnIndex =
    indicesRes.indices.find((i) => i.indexId === 'VN-Index') ||
    indicesRes.indices[0];
  const vnIndexText = vnIndex
    ? `${vnIndex.indexId}: ${vnIndex.value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} điểm (${vnIndex.changePct >= 0 ? '+' : ''}${vnIndex.changePct.toFixed(2)}%)`
    : 'VN-Index đang cập nhật';

  const watchHits = candidates.flatMap((c) => c.matchedTickers);
  const topWatchTickers = Array.from(new Set(watchHits)).slice(0, 4);
  const watchlistHighlight =
    topWatchTickers.length > 0
      ? `Mã tâm điểm trong tin: ${topWatchTickers.join(', ')}`
      : candidates[0]?.newsroomCategory === 'Tài chính & Chứng khoán'
        ? candidates[0].title.slice(0, 75)
        : 'Chưa ghi nhận biến động đột biến riêng lẻ';

  const topSocial = socialRes.trends[0];
  const topSocialTrend = topSocial
    ? `[${topSocial.platform}] ${topSocial.title.slice(0, 72)} (${topSocial.growthMetric})`
    : 'Xu hướng cộng đồng ổn định';

  const editionLabel =
    editionType === 'morning' ? 'Ấn bản Sáng (08:00)' : 'Ấn bản Chiều (17:00)';

  const top10 = candidates.slice(0, 10);

  let mode: 'gemini' | 'quantitative' = 'quantitative';
  let executiveHighlights: string[] = [];
  const aiSummariesMap = new Map<number, string>();

  const ai = getAiClientOrNull();
  if (ai && !isApiInCooldown('gemini') && top10.length > 0) {
    const start = Date.now();
    try {
      const prompt = `Bạn là Tổng biên tập bản tin nhanh Lăng Kính.
Hãy biên tập ${editionLabel} cho ngày ${dateStr} (${windowLabel}).
Dưới đây là Top ${top10.length} tin tức nổi bật đã được chấm điểm ưu tiên:
${top10
  .map(
    (c, idx) =>
      `${idx + 1}. [${c.newsroomCategory} | ${c.region}] ${c.title}\n   Nguồn: ${c.sourceName} | Tóm tắt gốc: ${c.summary.slice(0, 220)}`
  )
  .join('\n')}

Bối cảnh thị trường: ${vnIndexText}. Xu hướng Mạng xã hội #1: ${topSocialTrend}.

Yêu cầu trả về JSON tiếng Việt chuẩn xác, sắc sảo, không dài dòng:
- executiveHighlights: đúng 3 gạch đầu dòng tóm lược bức tranh toàn cảnh quan trọng nhất cho người bận rộn.
- summaries: mảng gồm ${top10.length} phần tử theo đúng thứ tự index 1..${top10.length}, mỗi phần tử có rank (1..${top10.length}) và oneLineSummary (đúng 1 câu báo chí cô đọng, tối đa 28 từ, giữ nguyên số liệu thực tế).`;

      const response = await withTimeout(
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                executiveHighlights: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                summaries: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      rank: { type: Type.NUMBER },
                      oneLineSummary: { type: Type.STRING },
                    },
                    required: ['rank', 'oneLineSummary'],
                  },
                },
              },
              required: ['executiveHighlights', 'summaries'],
            },
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        }),
        6500,
        'edition'
      );

      recordApiCall({
        apiId: 'gemini',
        endpoint: `/api/newsroom/edition (${editionType})`,
        statusCode: 200,
        ok: true,
        latencyMs: Date.now() - start,
      });

      const parsed = JSON.parse(response.text || '{}') as {
        executiveHighlights?: string[];
        summaries?: Array<{ rank?: number; oneLineSummary?: string }>;
      };
      if (Array.isArray(parsed.executiveHighlights) && parsed.executiveHighlights.length > 0) {
        executiveHighlights = parsed.executiveHighlights.slice(0, 3);
      }
      if (Array.isArray(parsed.summaries)) {
        for (const s of parsed.summaries) {
          if (typeof s.rank === 'number' && typeof s.oneLineSummary === 'string') {
            aiSummariesMap.set(s.rank, s.oneLineSummary.trim());
          }
        }
      }
      if (executiveHighlights.length > 0) {
        mode = 'gemini';
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
      const isTimeout = msg.includes('GEMINI_TIMEOUT_');
      recordApiCall({
        apiId: 'gemini',
        endpoint: `/api/newsroom/edition (${editionType})`,
        statusCode: is429 ? 429 : isTimeout ? 504 : 500,
        ok: false,
        latencyMs: Date.now() - start,
        cooldownSeconds: is429 ? 45 : isTimeout ? 15 : 0,
      });
    }
  }

  // Quantitative zero-token fallback if Gemini skipped/429
  if (executiveHighlights.length === 0) {
    const lead = top10[0];
    const finStory = top10.find((s) => s.newsroomCategory === 'Tài chính & Chứng khoán');
    const worldStory = top10.find(
      (s) => s.region === 'Mỹ & Châu Âu' || s.region === 'Châu Á' || s.newsroomCategory === 'Thế giới'
    );
    executiveHighlights = [
      lead
        ? `Tâm điểm ${editionType === 'morning' ? 'đầu ngày' : 'cuối ngày'}: ${lead.title} (${lead.sourceName}).`
        : `Tổng hợp ${top10.length} tin chọn lọc từ ${totalReviewed} bản tin trong kho lưu trữ.`,
      finStory
        ? `Tài chính & Thị trường: ${finStory.title} · ${vnIndexText}.`
        : `Chỉ số thị trường: ${vnIndexText}.`,
      worldStory
        ? `Quốc tế & Xu hướng: ${worldStory.title}${topSocial ? ` · Nóng mạng xã hội: ${topSocial.title.slice(0, 65)}` : ''}.`
        : `Xu hướng Mạng xã hội #1: ${topSocialTrend}.`,
    ];
  }

  const rankedStories: EditionRankedStory[] = top10.map((c, idx) => {
    const rank = idx + 1;
    const rawOneLine =
      aiSummariesMap.get(rank) ||
      c.keyTakeaways[0] ||
      c.summary.split(/[.!?]\s/)[0] ||
      c.title;

    return {
      rank,
      title: c.title,
      oneLineSummary: rawOneLine.slice(0, 240),
      url: c.url,
      sourceName: c.sourceName,
      newsroomCategory: c.newsroomCategory,
      region: c.region,
      priorityScore: c.priorityScore,
      displayTimestamp: c.displayTimestamp,
      sentimentLabel: c.sentimentLabel,
      matchedTickers: c.matchedTickers,
    };
  });

  const existingCached = editionCache.get(editionKey);
  const edition: NewsroomEdition = {
    editionKey,
    dateStr,
    editionType,
    editionLabel,
    windowLabel,
    generatedAt: new Date().toISOString(),
    mode,
    executiveHighlights,
    quickMetrics: {
      vnIndexText,
      watchlistHighlight,
      topSocialTrend,
    },
    stories: rankedStories,
    totalCandidatesReviewed: totalReviewed,
    sentTelegramAt: existingCached?.sentTelegramAt || null,
    sentLarkAt: existingCached?.sentLarkAt || null,
  };

  editionCache.set(editionKey, edition);
  return edition;
}

export function markEditionDeliveryTimestamps(
  editionKey: string,
  result: { telegramOk?: boolean; larkOk?: boolean }
) {
  const ed = editionCache.get(editionKey);
  if (!ed) return;
  const nowIso = new Date().toISOString();
  if (result.telegramOk) ed.sentTelegramAt = nowIso;
  if (result.larkOk) ed.sentLarkAt = nowIso;
}

export function startEditionScheduler(
  runSyncBeforeEdition: () => Promise<void>
): void {
  if (schedulerTimer) return;

  schedulerTimer = setInterval(() => {
    void (async () => {
      try {
        const status = getWebhookChannelsStatus();
        if (!status.autoSendEnabled) return;
        if (!status.telegramConfigured && !status.larkConfigured) return;

        const clock = getVnClockNow();
        let targetType: EditionType | null = null;
        if (clock.hour === 8 && clock.minute >= 0 && clock.minute <= 5) {
          targetType = 'morning';
        } else if (clock.hour === 17 && clock.minute >= 0 && clock.minute <= 5) {
          targetType = 'afternoon';
        }
        if (!targetType) return;

        const key = `${clock.dateStr}::${targetType}`;
        if (autoSentRegistry.has(key)) return;
        autoSentRegistry.add(key);

        await runSyncBeforeEdition().catch(() => {});
        const edition = await generateNewsroomEdition({
          dateStr: clock.dateStr,
          editionType: targetType,
          forceRefresh: true,
        });
        const delivery = await sendEditionToTelegramAndLark(edition);
        markEditionDeliveryTimestamps(edition.editionKey, {
          telegramOk: delivery.telegram.ok,
          larkOk: delivery.lark.ok,
        });
      } catch {
        // non-blocking background cron tick
      }
    })();
  }, 60_000);
}
