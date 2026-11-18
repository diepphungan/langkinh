import type {
  ApiCallRecord,
  ApiUsageProviderSnapshot,
  ApiUsageResponse,
} from '../src/types/news.ts';

export type TrackedApiId =
  | 'gemini'
  | 'rss'
  | 'googlenews'
  | 'spaceflight'
  | 'hackernews'
  | 'devto'
  | 'gdelt'
  | 'openmeteo'
  | 'ssi'
  | 'yahoo_vn'
  | 'social_trends'
  | 'webhook';

interface ProviderConfig {
  id: TrackedApiId;
  name: string;
  category: string;
  limitDescription: string;
  windowLimit: number | null;
  windowSeconds: number;
}

const PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    id: 'gemini',
    name: 'Gemini API (gemini-4-hydrogen)',
    category: 'AI Tổng hợp & NLP',
    limitDescription: 'Giới hạn tham chiếu Free Tier: ~15 yêu cầu/phút (1.500/ngày)',
    windowLimit: 15,
    windowSeconds: 60,
  },
  {
    id: 'rss',
    name: 'Báo chí RSS/Atom & Sitemap Pool',
    category: 'Nguồn báo chí RSS',
    limitDescription: 'Không giới hạn cứng — luân phiên tối đa 5 luồng/đợt',
    windowLimit: 40,
    windowSeconds: 60,
  },
  {
    id: 'googlenews',
    name: 'Google News Dynamic RSS',
    category: 'Auto-Discovery Crawler',
    limitDescription: 'RSS theo Watchlist & từ khóa — 0 token AI',
    windowLimit: 30,
    windowSeconds: 60,
  },
  {
    id: 'spaceflight',
    name: 'Spaceflight News API (v4)',
    category: 'Public API (Khoa học)',
    limitDescription: 'Không cần key — giới hạn mềm ~60 yêu cầu/phút',
    windowLimit: 60,
    windowSeconds: 60,
  },
  {
    id: 'hackernews',
    name: 'Hacker News API (Firebase)',
    category: 'Public API (Công nghệ)',
    limitDescription: 'Không giới hạn cứng — khuyến nghị ≤ 100 yêu cầu/phút',
    windowLimit: 100,
    windowSeconds: 60,
  },
  {
    id: 'devto',
    name: 'DEV Community API (Forem)',
    category: 'Public API (Kỹ thuật)',
    limitDescription: 'Giới hạn tối đa 30 yêu cầu / 30 giây',
    windowLimit: 30,
    windowSeconds: 30,
  },
  {
    id: 'gdelt',
    name: 'GDELT DOC 2.0 Global News API',
    category: 'Public API (Tin toàn cầu)',
    limitDescription: 'Giới hạn cứng: tối đa 1 yêu cầu / 5 giây',
    windowLimit: 1,
    windowSeconds: 5,
  },
  {
    id: 'openmeteo',
    name: 'Open-Meteo Forecast & Geocoding',
    category: 'Public API (Thời tiết)',
    limitDescription: 'Miễn phí phi thương mại: 10.000 yêu cầu/ngày',
    windowLimit: 60,
    windowSeconds: 60,
  },
  {
    id: 'ssi',
    name: 'SSI FastConnect Data API (v2)',
    category: 'Chứng khoán VN (Chính thống)',
    limitDescription: 'Token JWT tự làm mới; giới hạn khuyến nghị ~60 yêu cầu/phút',
    windowLimit: 60,
    windowSeconds: 60,
  },
  {
    id: 'yahoo_vn',
    name: 'VN Market Quote Fallback (.VN)',
    category: 'Dữ liệu Thị trường (Dự phòng)',
    limitDescription: 'Luồng giá & nến OHLC/Intraday dự phòng khi chưa cấu hình SSI',
    windowLimit: 60,
    windowSeconds: 60,
  },
  {
    id: 'social_trends',
    name: 'Social Trends Multi-Stream (Google Trends / Reddit / VN)',
    category: 'Mạng xã hội & Xu hướng',
    limitDescription: '4 luồng không cần API key; cache tự động 10 phút',
    windowLimit: 40,
    windowSeconds: 60,
  },
  {
    id: 'webhook',
    name: 'Telegram Bot & Lark Custom Webhook',
    category: 'Gửi Ấn bản Tự động (08:00 & 17:00)',
    limitDescription: 'Telegram Bot API (~30 msg/s) · Lark Interactive Card',
    windowLimit: 30,
    windowSeconds: 60,
  },
];

interface ProviderRuntimeStats {
  timestamps: number[];
  totalCalls: number;
  successCalls: number;
  rateLimitedCalls: number;
  errorCalls: number;
  lastCalledAt: string | null;
  lastStatus: number | null;
  lastLatencyMs: number | null;
  cooldownUntilMs: number;
}

const runtimeStats = new Map<TrackedApiId, ProviderRuntimeStats>();
for (const cfg of PROVIDER_CONFIGS) {
  runtimeStats.set(cfg.id, {
    timestamps: [],
    totalCalls: 0,
    successCalls: 0,
    rateLimitedCalls: 0,
    errorCalls: 0,
    lastCalledAt: null,
    lastStatus: null,
    lastLatencyMs: null,
    cooldownUntilMs: 0,
  });
}

const recentCalls: ApiCallRecord[] = [];
const MAX_RECENT_CALLS = 40;

export function recordApiCall(params: {
  apiId: TrackedApiId;
  endpoint: string;
  statusCode: number;
  ok: boolean;
  latencyMs: number;
  detail?: string;
  cooldownSeconds?: number;
}) {
  const now = Date.now();
  const cfg = PROVIDER_CONFIGS.find((c) => c.id === params.apiId);
  const stats = runtimeStats.get(params.apiId);
  if (!cfg || !stats) return;

  stats.timestamps.push(now);
  // prune older than 10 minutes
  stats.timestamps = stats.timestamps.filter((t) => now - t < 10 * 60 * 1000);
  stats.totalCalls += 1;
  if (params.statusCode === 429) {
    stats.rateLimitedCalls += 1;
    stats.cooldownUntilMs = Math.max(
      stats.cooldownUntilMs,
      now + (params.cooldownSeconds || 30) * 1000
    );
  } else if (params.ok) {
    stats.successCalls += 1;
    if (params.apiId === 'gdelt') {
      stats.cooldownUntilMs = Math.max(stats.cooldownUntilMs, now + 5000);
    }
  } else {
    stats.errorCalls += 1;
  }

  stats.lastCalledAt = new Date(now).toISOString();
  stats.lastStatus = params.statusCode;
  stats.lastLatencyMs = Math.max(0, Math.round(params.latencyMs));

  recentCalls.unshift({
    id: `call-${now}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: stats.lastCalledAt,
    apiId: cfg.id,
    apiName: cfg.name,
    endpoint: params.endpoint,
    statusCode: params.statusCode,
    ok: params.ok,
    latencyMs: stats.lastLatencyMs,
    detail: params.detail,
  });

  if (recentCalls.length > MAX_RECENT_CALLS) {
    recentCalls.length = MAX_RECENT_CALLS;
  }
}

export function isApiInCooldown(apiId: TrackedApiId): boolean {
  const stats = runtimeStats.get(apiId);
  if (!stats) return false;
  return stats.cooldownUntilMs > Date.now();
}

export function getApiUsageSnapshot(): ApiUsageResponse {
  const now = Date.now();
  const providers: ApiUsageProviderSnapshot[] = PROVIDER_CONFIGS.map((cfg) => {
    const stats = runtimeStats.get(cfg.id)!;
    const windowMs = cfg.windowSeconds * 1000;
    const callsInWindow = stats.timestamps.filter((t) => now - t <= windowMs).length;
    const cooldownRemainingSeconds =
      stats.cooldownUntilMs > now
        ? Math.ceil((stats.cooldownUntilMs - now) / 1000)
        : 0;

    return {
      id: cfg.id,
      name: cfg.name,
      category: cfg.category,
      limitDescription: cfg.limitDescription,
      windowLimit: cfg.windowLimit,
      windowSeconds: cfg.windowSeconds,
      callsInWindow,
      totalCalls: stats.totalCalls,
      successCalls: stats.successCalls,
      rateLimitedCalls: stats.rateLimitedCalls,
      errorCalls: stats.errorCalls,
      lastCalledAt: stats.lastCalledAt,
      lastStatus: stats.lastStatus,
      lastLatencyMs: stats.lastLatencyMs,
      cooldownRemainingSeconds,
    };
  });

  return {
    snapshotAt: new Date(now).toISOString(),
    providers,
    recentCalls: recentCalls.slice(0, 25),
  };
}
