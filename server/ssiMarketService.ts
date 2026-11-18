import type {
  CandlestickPatternId,
  CandlestickSignalItem,
  CashflowAnomalyItem,
  ChartTimeframe,
  CorporateEventItem,
  ErraticPatternDisplayLabel,
  ErraticPatternType,
  FinanceArticleImpactLabel,
  FinanceRuntimeSettingsStatus,
  FinanceTaggedArticle,
  IntradayErraticMover,
  IntradaySessionPoint,
  MacroQuoteItem,
  MarketDataSourceMode,
  MarketExchange,
  MarketIndexQuote,
  OhlcBar,
  ReversalSignalItem,
  RiskRewardSummary,
  SsiSecurityItem,
  StockChartTechnicalResponse,
  StockQuoteSnapshot,
  StockSectorGroup,
  StoredNewsArticle,
  TechnicalIndicatorsSnapshot,
  TradeSetupPlan,
  TradeSetupStatus,
  ValuationMetricKind,
  WatchlistLiquidityTier,
  WatchlistMaPosition,
  WatchlistRoeTier,
  WatchlistStockAnalytics,
  WatchlistValuationTier,
  WatchlistVerdictLabel,
} from '../src/types/news.ts';
import { recordApiCall } from './apiQuotaTracker.ts';

const SSI_BASE_URL = 'https://fc-data.ssi.com.vn/api/v2/Market';

export const BUILTIN_VN_SECURITIES: SsiSecurityItem[] = [
  { symbol: 'SSI', exchange: 'HOSE', companyName: 'Chứng khoán SSI' },
  { symbol: 'FPT', exchange: 'HOSE', companyName: 'Tập đoàn FPT' },
  { symbol: 'VCB', exchange: 'HOSE', companyName: 'Ngân hàng Vietcombank' },
  { symbol: 'HPG', exchange: 'HOSE', companyName: 'Tập đoàn Hòa Phát' },
  { symbol: 'MWG', exchange: 'HOSE', companyName: 'Thế Giới Di Động' },
  { symbol: 'TCB', exchange: 'HOSE', companyName: 'Ngân hàng Techcombank' },
  { symbol: 'MBB', exchange: 'HOSE', companyName: 'Ngân hàng Quân đội MB' },
  { symbol: 'VPB', exchange: 'HOSE', companyName: 'Ngân hàng VPBank' },
  { symbol: 'ACB', exchange: 'HOSE', companyName: 'Ngân hàng Á Châu ACB' },
  { symbol: 'BID', exchange: 'HOSE', companyName: 'Ngân hàng BIDV' },
  { symbol: 'CTG', exchange: 'HOSE', companyName: 'Ngân hàng VietinBank' },
  { symbol: 'STB', exchange: 'HOSE', companyName: 'Ngân hàng Sacombank' },
  { symbol: 'VNM', exchange: 'HOSE', companyName: 'Sữa Việt Nam Vinamilk' },
  { symbol: 'VHM', exchange: 'HOSE', companyName: 'Vinhomes' },
  { symbol: 'VIC', exchange: 'HOSE', companyName: 'Tập đoàn Vingroup' },
  { symbol: 'VRE', exchange: 'HOSE', companyName: 'Vincom Retail' },
  { symbol: 'MSN', exchange: 'HOSE', companyName: 'Tập đoàn Masan' },
  { symbol: 'GAS', exchange: 'HOSE', companyName: 'Tổng Công ty Khí Việt Nam' },
  { symbol: 'PLX', exchange: 'HOSE', companyName: 'Tập đoàn Xăng dầu Petrolimex' },
  { symbol: 'POW', exchange: 'HOSE', companyName: 'Điện lực Dầu khí PV Power' },
  { symbol: 'GVR', exchange: 'HOSE', companyName: 'Công nghiệp Cao su Việt Nam' },
  { symbol: 'SAB', exchange: 'HOSE', companyName: 'Bia Rượu Nước giải khát Sabeco' },
  { symbol: 'HDB', exchange: 'HOSE', companyName: 'Ngân hàng HDBank' },
  { symbol: 'TPB', exchange: 'HOSE', companyName: 'Ngân hàng TPBank' },
  { symbol: 'VIB', exchange: 'HOSE', companyName: 'Ngân hàng Quốc tế VIB' },
  { symbol: 'SSB', exchange: 'HOSE', companyName: 'Ngân hàng SeABank' },
  { symbol: 'SHB', exchange: 'HOSE', companyName: 'Ngân hàng Sài Gòn - Hà Nội' },
  { symbol: 'BVH', exchange: 'HOSE', companyName: 'Tập đoàn Bảo Việt' },
  { symbol: 'BCM', exchange: 'HOSE', companyName: 'Đầu tư và Phát triển Becamex' },
  { symbol: 'VJC', exchange: 'HOSE', companyName: 'Hàng không Vietjet Air' },
  { symbol: 'HVN', exchange: 'HOSE', companyName: 'Vietnam Airlines' },
  { symbol: 'VND', exchange: 'HOSE', companyName: 'Chứng khoán VNDIRECT' },
  { symbol: 'VCI', exchange: 'HOSE', companyName: 'Chứng khoán Vietcap' },
  { symbol: 'HCM', exchange: 'HOSE', companyName: 'Chứng khoán TP.HCM (HSC)' },
  { symbol: 'DGC', exchange: 'HOSE', companyName: 'Hóa chất Đức Giang' },
  { symbol: 'PNJ', exchange: 'HOSE', companyName: 'Vàng bạc Đá quý Phú Nhuận' },
  { symbol: 'FRT', exchange: 'HOSE', companyName: 'Bán lẻ Kỹ thuật số FPT Retail' },
  { symbol: 'REE', exchange: 'HOSE', companyName: 'Cơ điện lạnh REE' },
  { symbol: 'GMD', exchange: 'HOSE', companyName: 'Gemadept' },
  { symbol: 'KBC', exchange: 'HOSE', companyName: 'Phát triển Đô thị Kinh Bắc' },
  { symbol: 'NVL', exchange: 'HOSE', companyName: 'Tập đoàn Novaland' },
  { symbol: 'DIG', exchange: 'HOSE', companyName: 'DIC Corp' },
  { symbol: 'DXG', exchange: 'HOSE', companyName: 'Tập đoàn Đất Xanh' },
  { symbol: 'PDR', exchange: 'HOSE', companyName: 'Bất động sản Phát Đạt' },
  { symbol: 'SHS', exchange: 'HNX', companyName: 'Chứng khoán Sài Gòn - Hà Nội' },
  { symbol: 'PVS', exchange: 'HNX', companyName: 'Dịch vụ Kỹ thuật Dầu khí PTSC' },
  { symbol: 'CEO', exchange: 'HNX', companyName: 'Tập đoàn C.E.O' },
  { symbol: 'IDC', exchange: 'HNX', companyName: 'Tổng công ty IDICO' },
  { symbol: 'ACV', exchange: 'UPCOM', companyName: 'Cảng hàng không Việt Nam' },
  { symbol: 'BSR', exchange: 'HOSE', companyName: 'Lọc hóa dầu Bình Sơn' },
  { symbol: 'VEA', exchange: 'UPCOM', companyName: 'Máy động lực và Máy nông nghiệp VEAM' },
  { symbol: 'VGI', exchange: 'UPCOM', companyName: 'Đầu tư Quốc tế Viettel Global' },
];

interface RuntimeCredentialsState {
  consumerId: string;
  consumerSecret: string;
  webhookUrl: string;
  accessToken: string | null;
  tokenExpiresAtMs: number;
}

const runtimeConfig: RuntimeCredentialsState = {
  consumerId: '',
  consumerSecret: '',
  webhookUrl: (process.env.FINANCE_WEBHOOK_URL || '').trim(),
  accessToken: null,
  tokenExpiresAtMs: 0,
};

let securitiesCache: {
  items: SsiSecurityItem[];
  cachedAt: string;
  expiresAtMs: number;
} | null = null;

const quoteCache = new Map<string, { data: StockQuoteSnapshot; expiresAt: number }>();
const ohlcCache = new Map<string, { data: OhlcBar[]; expiresAt: number }>();
const yahooMissingCache = new Map<string, number>();
let indexCache: { data: MarketIndexQuote[]; expiresAt: number } | null = null;

function isVnDirectPreferredExchange(symbol: string): boolean {
  const catalog = securitiesCache?.items || BUILTIN_VN_SECURITIES;
  const item = catalog.find((s) => s.symbol === symbol);
  return item?.exchange === 'HNX' || item?.exchange === 'UPCOM';
}

function resolveSsiCredentials(): {
  consumerId: string;
  consumerSecret: string;
  source: 'env' | 'runtime' | 'none';
} {
  if (runtimeConfig.consumerId && runtimeConfig.consumerSecret) {
    return {
      consumerId: runtimeConfig.consumerId,
      consumerSecret: runtimeConfig.consumerSecret,
      source: 'runtime',
    };
  }
  const envId = (process.env.SSI_CONSUMER_ID || '').trim();
  const envSecret = (process.env.SSI_CONSUMER_SECRET || '').trim();
  if (envId && envSecret) {
    return {
      consumerId: envId,
      consumerSecret: envSecret,
      source: 'env',
    };
  }
  return { consumerId: '', consumerSecret: '', source: 'none' };
}

function maskString(val: string, keepStart = 4, keepEnd = 4): string {
  if (!val) return '';
  if (val.length <= keepStart + keepEnd) {
    return `${val.slice(0, 2)}***`;
  }
  return `${val.slice(0, keepStart)}••••${val.slice(-keepEnd)}`;
}

export function updateFinanceRuntimeSettings(params: {
  ssiConsumerId?: string;
  ssiConsumerSecret?: string;
  clearSsiCredentials?: boolean;
  webhookUrl?: string;
}): FinanceRuntimeSettingsStatus {
  if (params.clearSsiCredentials) {
    runtimeConfig.consumerId = '';
    runtimeConfig.consumerSecret = '';
    runtimeConfig.accessToken = null;
    runtimeConfig.tokenExpiresAtMs = 0;
    securitiesCache = null;
    indexCache = null;
    quoteCache.clear();
  } else if (
    typeof params.ssiConsumerId === 'string' &&
    typeof params.ssiConsumerSecret === 'string'
  ) {
    const nextId = params.ssiConsumerId.trim();
    const nextSecret = params.ssiConsumerSecret.trim();
    if (nextId && nextSecret) {
      runtimeConfig.consumerId = nextId;
      runtimeConfig.consumerSecret = nextSecret;
      runtimeConfig.accessToken = null;
      runtimeConfig.tokenExpiresAtMs = 0;
      securitiesCache = null;
      indexCache = null;
      quoteCache.clear();
    }
  }

  if (typeof params.webhookUrl === 'string') {
    runtimeConfig.webhookUrl = params.webhookUrl.trim();
  }

  return getFinanceRuntimeSettingsStatus();
}

export function getConfiguredWebhookUrl(): string {
  return runtimeConfig.webhookUrl;
}

export function getFinanceRuntimeSettingsStatus(): FinanceRuntimeSettingsStatus {
  const creds = resolveSsiCredentials();
  const tokenValid =
    Boolean(runtimeConfig.accessToken) && runtimeConfig.tokenExpiresAtMs > Date.now() + 60_000;
  return {
    ssiConfigured: creds.source !== 'none',
    ssiSource: creds.source,
    ssiConsumerIdMasked: creds.consumerId ? maskString(creds.consumerId) : '',
    tokenCached: tokenValid,
    tokenExpiresAt: tokenValid ? new Date(runtimeConfig.tokenExpiresAtMs).toISOString() : null,
    webhookConfigured: Boolean(runtimeConfig.webhookUrl),
    webhookUrlMasked: runtimeConfig.webhookUrl
      ? maskString(runtimeConfig.webhookUrl, 16, 8)
      : '',
    securitiesCount: securitiesCache?.items.length || BUILTIN_VN_SECURITIES.length,
    securitiesCachedAt: securitiesCache?.cachedAt || null,
    marketDataMode: creds.source !== 'none' ? 'ssi' : 'fallback',
  };
}

function decodeJwtExpiryMs(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      exp?: number;
    };
    if (typeof payload.exp === 'number' && payload.exp > 0) {
      return payload.exp * 1000;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getSsiAccessToken(): Promise<string> {
  const creds = resolveSsiCredentials();
  if (creds.source === 'none') {
    throw new Error('SSI_NOT_CONFIGURED');
  }

  // Auto-refresh 5 minutes before expiration
  if (runtimeConfig.accessToken && runtimeConfig.tokenExpiresAtMs > Date.now() + 5 * 60_000) {
    return runtimeConfig.accessToken;
  }

  const start = Date.now();
  const res = await fetch(`${SSI_BASE_URL}/AccessToken`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      consumerID: creds.consumerId,
      consumerSecret: creds.consumerSecret,
    }),
    signal: AbortSignal.timeout(8000),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    status?: number;
    message?: string;
    data?: { accessToken?: string } | string;
  };

  recordApiCall({
    apiId: 'ssi',
    endpoint: '/Market/AccessToken',
    statusCode: res.status,
    ok: res.ok,
    latencyMs: Date.now() - start,
    detail: res.ok ? 'Cấp/làm mới JWT Token' : payload.message || 'Auth failed',
  });

  const token =
    typeof payload.data === 'string'
      ? payload.data
      : payload.data && typeof payload.data.accessToken === 'string'
        ? payload.data.accessToken
        : '';

  if (!res.ok || !token) {
    throw new Error(payload.message || `Không thể xác thực SSI FastConnect (mã ${res.status}).`);
  }

  runtimeConfig.accessToken = token;
  runtimeConfig.tokenExpiresAtMs =
    decodeJwtExpiryMs(token) || Date.now() + 7.5 * 60 * 60 * 1000;
  return token;
}

async function fetchSsiEndpoint<T>(
  endpointName: string,
  searchParams: Record<string, string | number | boolean>
): Promise<T[]> {
  const token = await getSsiAccessToken();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    qs.set(k, String(v));
  }
  const url = `${SSI_BASE_URL}/${endpointName}?${qs.toString()}`;
  const start = Date.now();
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(9000),
  });

  const json = (await res.json().catch(() => ({}))) as {
    status?: number | string;
    message?: string;
    data?: T[] | null;
  };

  recordApiCall({
    apiId: 'ssi',
    endpoint: `/Market/${endpointName}`,
    statusCode: res.status,
    ok: res.ok,
    latencyMs: Date.now() - start,
    detail:
      searchParams.Symbol || searchParams.IndexId || searchParams.Market
        ? String(searchParams.Symbol || searchParams.IndexId || searchParams.Market)
        : undefined,
  });

  if (res.status === 401) {
    runtimeConfig.accessToken = null;
    runtimeConfig.tokenExpiresAtMs = 0;
  }

  if (!res.ok) {
    throw new Error(json.message || `SSI ${endpointName} trả về mã ${res.status}`);
  }

  return Array.isArray(json.data) ? json.data : [];
}

function formatVnDateDDMMYYYY(daysOffset = 0): string {
  const d = new Date(Date.now() + daysOffset * 86_400_000);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(d);
  const day = parts.find((p) => p.type === 'day')?.value || '01';
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const year = parts.find((p) => p.type === 'year')?.value || '2026';
  return `${day}/${month}/${year}`;
}

function readNum(rec: Record<string, unknown>, keys: string[], fallback = 0): number {
  for (const k of keys) {
    if (k in rec && rec[k] !== null && rec[k] !== undefined && rec[k] !== '') {
      const n = Number(rec[k]);
      if (!Number.isNaN(n)) return n;
    }
  }
  const lowerMap = new Map<string, unknown>();
  for (const [rk, rv] of Object.entries(rec)) {
    lowerMap.set(rk.toLowerCase(), rv);
  }
  for (const k of keys) {
    const v = lowerMap.get(k.toLowerCase());
    if (v !== null && v !== undefined && v !== '') {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return fallback;
}

function readStr(rec: Record<string, unknown>, keys: string[], fallback = ''): string {
  for (const k of keys) {
    if (k in rec && typeof rec[k] === 'string' && rec[k].trim()) {
      return rec[k].trim();
    }
  }
  const lowerMap = new Map<string, unknown>();
  for (const [rk, rv] of Object.entries(rec)) {
    lowerMap.set(rk.toLowerCase(), rv);
  }
  for (const k of keys) {
    const v = lowerMap.get(k.toLowerCase());
    if (typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  return fallback;
}

export async function getSecuritiesCatalog(forceRefresh = false): Promise<{
  items: SsiSecurityItem[];
  sourceMode: MarketDataSourceMode;
  cachedAt: string;
}> {
  const creds = resolveSsiCredentials();
  if (!forceRefresh && securitiesCache && securitiesCache.expiresAtMs > Date.now()) {
    return {
      items: securitiesCache.items,
      sourceMode: creds.source !== 'none' ? 'ssi' : 'fallback',
      cachedAt: securitiesCache.cachedAt,
    };
  }

  if (creds.source !== 'none') {
    try {
      const markets: MarketExchange[] = ['HOSE', 'HNX', 'UPCOM'];
      const results = await Promise.allSettled(
        markets.map((m) =>
          fetchSsiEndpoint<Record<string, unknown>>('Securities', {
            Market: m,
            PageIndex: 1,
            PageSize: 1000,
          }).then((rows) => ({ market: m, rows }))
        )
      );

      const merged = new Map<string, SsiSecurityItem>();
      for (const built of BUILTIN_VN_SECURITIES) {
        merged.set(built.symbol, built);
      }

      let gotSsiRows = 0;
      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        const { market, rows } = r.value;
        for (const row of rows) {
          const symbol = readStr(row, ['Symbol', 'StockSymbol', 'Ticker']).toUpperCase();
          if (!symbol || !/^[A-Z0-9]{2,10}$/.test(symbol)) continue;
          gotSsiRows += 1;
          const companyName =
            readStr(row, ['StockName', 'CompanyName', 'SecName']) ||
            merged.get(symbol)?.companyName ||
            symbol;
          const companyNameEn = readStr(row, ['StockEnName', 'CompanyNameEn']);
          const rawMkt = readStr(row, ['Market', 'Exchange']).toUpperCase();
          const exchange: MarketExchange =
            rawMkt === 'HNX' || rawMkt === 'UPCOM' ? rawMkt : market;
          merged.set(symbol, {
            symbol,
            exchange,
            companyName,
            companyNameEn: companyNameEn || undefined,
          });
        }
      }

      if (gotSsiRows > 0) {
        const items = Array.from(merged.values()).sort((a, b) =>
          a.symbol.localeCompare(b.symbol)
        );
        const nowIso = new Date().toISOString();
        securitiesCache = {
          items,
          cachedAt: nowIso,
          expiresAtMs: Date.now() + 24 * 60 * 60 * 1000,
        };
        return { items, sourceMode: 'ssi', cachedAt: nowIso };
      }
    } catch {
      // Fallback transparently to built-in VN directory
    }
  }

  const nowIso = new Date().toISOString();
  return {
    items: BUILTIN_VN_SECURITIES,
    sourceMode: 'fallback',
    cachedAt: securitiesCache?.cachedAt || nowIso,
  };
}

interface YahooChartResult {
  meta?: {
    regularMarketPrice?: number;
    chartPreviousClose?: number;
    previousClose?: number;
    regularMarketDayHigh?: number;
    regularMarketDayLow?: number;
    regularMarketVolume?: number;
  };
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      open?: Array<number | null>;
      high?: Array<number | null>;
      low?: Array<number | null>;
      close?: Array<number | null>;
      volume?: Array<number | null>;
    }>;
  };
}

async function fetchYahooChartRaw(
  yahooSymbol: string,
  range = '3mo',
  interval = '1d'
): Promise<YahooChartResult> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol
  )}?range=${range}&interval=${interval}`;
  const start = Date.now();
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LangKinhFinance/1.0)',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(7000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    chart?: { result?: YahooChartResult[]; error?: { description?: string } };
  };
  recordApiCall({
    apiId: 'yahoo_vn',
    endpoint: `/chart/${yahooSymbol} (${interval}/${range})`,
    statusCode: res.status,
    ok: res.ok && Boolean(json.chart?.result?.[0]),
    latencyMs: Date.now() - start,
  });

  const first = json.chart?.result?.[0];
  if (!res.ok || !first) {
    throw new Error(
      json.chart?.error?.description || `Không thể tải dữ liệu cho ${yahooSymbol} (${res.status})`
    );
  }
  return first;
}

function formatYahooTimestampLabel(tsSec: number, isIntraday: boolean): string {
  const dt = new Date(tsSec * 1000);
  if (!isIntraday) {
    return dt.toISOString().split('T')[0];
  }
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(dt);
  const dd = parts.find((p) => p.type === 'day')?.value || '01';
  const mm = parts.find((p) => p.type === 'month')?.value || '01';
  const hh = parts.find((p) => p.type === 'hour')?.value || '09';
  const mi = parts.find((p) => p.type === 'minute')?.value || '00';
  return `${dd}/${mm} ${hh}:${mi}`;
}

function parseYahooBars(chart: YahooChartResult, isIntraday = false): OhlcBar[] {
  const ts = chart.timestamp || [];
  const q = chart.indicators?.quote?.[0];
  if (!q || ts.length === 0) return [];
  const bars: OhlcBar[] = [];
  for (let i = 0; i < ts.length; i += 1) {
    const close = q.close?.[i];
    const open = q.open?.[i] ?? close;
    const high = q.high?.[i] ?? close;
    const low = q.low?.[i] ?? close;
    const vol = q.volume?.[i] ?? 0;
    if (close === null || close === undefined || Number.isNaN(close)) continue;
    bars.push({
      date: formatYahooTimestampLabel(ts[i], isIntraday),
      open: Number(open ?? close),
      high: Number(high ?? close),
      low: Number(low ?? close),
      close: Number(close),
      volume: Math.max(0, Math.round(Number(vol || 0))),
    });
  }
  return bars;
}

function calcBandLimits(refPrice: number, exchange: MarketExchange) {
  const band = exchange === 'HOSE' ? 0.07 : exchange === 'HNX' ? 0.1 : 0.15;
  return {
    ceilingPrice: Math.round(refPrice * (1 + band)),
    floorPrice: Math.round(refPrice * (1 - band)),
  };
}

export async function getMarketIndices(): Promise<{
  indices: MarketIndexQuote[];
  sourceMode: MarketDataSourceMode;
}> {
  if (indexCache && indexCache.expiresAt > Date.now()) {
    return {
      indices: indexCache.data,
      sourceMode: indexCache.data[0]?.sourceMode || 'fallback',
    };
  }

  const creds = resolveSsiCredentials();
  const fromDate = formatVnDateDDMMYYYY(-10);
  const toDate = formatVnDateDDMMYYYY(0);

  if (creds.source !== 'none') {
    try {
      const specs: Array<{ ssiId: string; label: MarketIndexQuote['indexId'] }> = [
        { ssiId: 'VNINDEX', label: 'VN-Index' },
        { ssiId: 'VN30', label: 'VN30' },
        { ssiId: 'HNXINDEX', label: 'HNX-Index' },
      ];
      const settled = await Promise.allSettled(
        specs.map(async (sp) => {
          const rows = await fetchSsiEndpoint<Record<string, unknown>>('DailyIndex', {
            IndexId: sp.ssiId,
            FromDate: fromDate,
            ToDate: toDate,
            PageIndex: 1,
            PageSize: 15,
            Ascending: false,
          });
          const latest = rows[0];
          if (!latest) throw new Error('NO_INDEX_ROW');
          const value = readNum(latest, ['IndexValue', 'CloseIndex', 'Value', 'Close']);
          const change = readNum(latest, ['Change', 'NetChange', 'IndexChange']);
          const prev = value - change;
          const changePct =
            readNum(latest, ['RatioChange', 'PerChange', 'ChangePct']) ||
            (prev > 0 ? Number(((change / prev) * 100).toFixed(2)) : 0);
          const volume = readNum(latest, ['TotalQtty', 'TotalVol', 'AllQty', 'Volume']);
          const tradingDate = readStr(latest, ['TradingDate', 'Date'], toDate);
          return {
            indexId: sp.label,
            value: Number(value.toFixed(2)),
            change: Number(change.toFixed(2)),
            changePct: Number(changePct.toFixed(2)),
            volume: Math.round(volume),
            tradingDate,
            sourceMode: 'ssi' as MarketDataSourceMode,
          };
        })
      );

      const okList: MarketIndexQuote[] = [];
      for (const s of settled) {
        if (s.status === 'fulfilled' && s.value.value > 0) {
          okList.push(s.value);
        }
      }
      if (okList.length >= 2) {
        indexCache = { data: okList, expiresAt: Date.now() + 60_000 };
        return { indices: okList, sourceMode: 'ssi' };
      }
    } catch {
      // Fallback below
    }
  }

  // Fallback live path using real VPS index feed first (VN-Index, VN30, HNX-Index), then Yahoo backup for any missing index
  const indices: MarketIndexQuote[] = [];
  const vpsStart = Date.now();
  try {
    const vpsRes = await fetch('https://bgapidatafeed.vps.com.vn/getlistindexdetail/10,11,02', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LangKinhFinance/1.0)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(5500),
    });
    const rows = (await vpsRes.json().catch(() => [])) as Array<{
      mc?: string;
      vol?: number | string;
      cIndex?: number | string;
      oIndex?: number | string;
    }>;
    recordApiCall({
      apiId: 'yahoo_vn',
      endpoint: '/vps/getlistindexdetail/10,11,02',
      statusCode: vpsRes.status,
      ok: vpsRes.ok && Array.isArray(rows) && rows.length > 0,
      latencyMs: Date.now() - vpsStart,
    });

    if (vpsRes.ok && Array.isArray(rows)) {
      const mcToLabel: Record<string, MarketIndexQuote['indexId']> = {
        '10': 'VN-Index',
        '11': 'VN30',
        '02': 'HNX-Index',
      };
      const order: MarketIndexQuote['indexId'][] = ['VN-Index', 'VN30', 'HNX-Index'];
      const byLabel = new Map<MarketIndexQuote['indexId'], MarketIndexQuote>();

      for (const row of rows) {
        const label = mcToLabel[String(row.mc || '').trim()];
        if (!label) continue;
        const value = Number(Number(row.cIndex || 0).toFixed(2));
        if (value <= 0) continue;
        const prev = Number(row.oIndex || value);
        const change = Number((value - prev).toFixed(2));
        const changePct = prev > 0 ? Number((((value - prev) / prev) * 100).toFixed(2)) : 0;
        const volume = Math.max(0, Math.round(Number(row.vol || 0)));
        byLabel.set(label, {
          indexId: label,
          value,
          change,
          changePct,
          volume,
          tradingDate: toDate,
          sourceMode: 'fallback',
        });
      }

      for (const lbl of order) {
        const item = byLabel.get(lbl);
        if (item) indices.push(item);
      }
    }
  } catch {
    recordApiCall({
      apiId: 'yahoo_vn',
      endpoint: '/vps/getlistindexdetail/10,11,02',
      statusCode: 0,
      ok: false,
      latencyMs: Date.now() - vpsStart,
    });
  }

  // Yahoo backup only for any index missing from VPS response
  const hasIndex = (id: MarketIndexQuote['indexId']) =>
    indices.some((x) => x.indexId === id);

  if (!hasIndex('VN-Index')) {
    try {
      const vniChart = await fetchYahooChartRaw('^VNINDEX.VN', '1mo');
      const bars = parseYahooBars(vniChart);
      const lastBar = bars[bars.length - 1];
      const prevBar = bars[bars.length - 2];
      const val = Number(vniChart.meta?.regularMarketPrice ?? lastBar?.close ?? 0);
      const prev = Number(prevBar?.close ?? vniChart.meta?.chartPreviousClose ?? val);
      const change = Number((val - prev).toFixed(2));
      const changePct = prev > 0 ? Number(((change / prev) * 100).toFixed(2)) : 0;
      if (val > 0) {
        indices.push({
          indexId: 'VN-Index',
          value: Number(val.toFixed(2)),
          change,
          changePct,
          volume: lastBar?.volume || 0,
          tradingDate: lastBar?.date || toDate,
          sourceMode: 'fallback',
        });
      }
    } catch {
      // ignore single failure
    }
  }

  if (!hasIndex('VN30')) {
    try {
      const vn30Etf = await fetchYahooChartRaw('E1VFVN30.VN', '1mo');
      const bars = parseYahooBars(vn30Etf);
      const lastBar = bars[bars.length - 1];
      const prevBar = bars[bars.length - 2];
      const val = Number(vn30Etf.meta?.regularMarketPrice ?? lastBar?.close ?? 0);
      const prev = Number(prevBar?.close ?? vn30Etf.meta?.chartPreviousClose ?? val);
      const change = Number((val - prev).toFixed(2));
      const changePct = prev > 0 ? Number(((change / prev) * 100).toFixed(2)) : 0;
      if (val > 0) {
        indices.push({
          indexId: 'VN30',
          value: Number(val.toFixed(0)),
          change: Math.round(change),
          changePct,
          volume: lastBar?.volume || 0,
          tradingDate: lastBar?.date || toDate,
          sourceMode: 'fallback',
        });
      }
    } catch {
      // ignore
    }
  }

  if (!hasIndex('HNX-Index')) {
    try {
      const hnxRep = await fetchYahooChartRaw('PVS.VN', '1mo');
      const bars = parseYahooBars(hnxRep);
      const lastBar = bars[bars.length - 1];
      const prevBar = bars[bars.length - 2];
      const val = Number(hnxRep.meta?.regularMarketPrice ?? lastBar?.close ?? 0);
      const prev = Number(prevBar?.close ?? hnxRep.meta?.chartPreviousClose ?? val);
      const change = Number((val - prev).toFixed(2));
      const changePct = prev > 0 ? Number(((change / prev) * 100).toFixed(2)) : 0;
      if (val > 0) {
        indices.push({
          indexId: 'HNX-Index',
          value: Number(val.toFixed(0)),
          change: Math.round(change),
          changePct,
          volume: lastBar?.volume || 0,
          tradingDate: lastBar?.date || toDate,
          sourceMode: 'fallback',
        });
      }
    } catch {
      // ignore
    }
  }

  if (indices.length > 0) {
    indexCache = { data: indices, expiresAt: Date.now() + 60_000 };
  }
  return { indices, sourceMode: 'fallback' };
}

let macroBenchmarksCache: { data: MacroQuoteItem[]; expiresAt: number } | null = null;

export async function getMacroBenchmarks(): Promise<MacroQuoteItem[]> {
  if (macroBenchmarksCache && macroBenchmarksCache.expiresAt > Date.now()) {
    return macroBenchmarksCache.data;
  }

  let usdRate = 25420;
  let usdChangePct = 0.05;
  let usdNote = 'Tỷ giá tham chiếu';

  let sjcText = '85,5tr';
  let sjcChangePct = 0.12;
  let sjcNote = 'Vàng SJC (triệu/lượng)';

  await Promise.allSettled([
    (async () => {
      const chart = await fetchYahooChartRaw('VND=X', '5d');
      const bars = parseYahooBars(chart);
      const lastBar = bars[bars.length - 1];
      const prevBar = bars[bars.length - 2];
      const val = Number(chart.meta?.regularMarketPrice ?? lastBar?.close ?? 0);
      const prev = Number(prevBar?.close ?? chart.meta?.chartPreviousClose ?? val);
      if (val > 20_000 && val < 35_000) {
        usdRate = Math.round(val);
        usdChangePct = prev > 0 ? Number((((val - prev) / prev) * 100).toFixed(2)) : 0;
        usdNote = 'Yahoo FX Live';
      }
    })(),
    (async () => {
      let resolvedSjc = false;
      try {
        const res = await fetch('https://sjc.com.vn/GoldPrice/Services/PriceService.ashx', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (compatible; LangKinhFinance/1.0)',
          },
          body: 'method=GetCurrentGoldPricesByBranch&BranchId=1',
          signal: AbortSignal.timeout(3200),
        });
        if (res.ok) {
          const json = (await res.json().catch(() => null)) as {
            data?: Array<{ TypeName?: string; SellValue?: number; BuyValue?: number }>;
          } | null;
          const rows = Array.isArray(json?.data) ? json.data : [];
          const sjcRow = rows.find((r) =>
            String(r.TypeName || '').toUpperCase().includes('SJC')
          ) || rows[0];
          const sellVal = Number(sjcRow?.SellValue || 0);
          if (sellVal > 50_000_000) {
            const millions = sellVal / 1_000_000;
            sjcText = `${millions.toFixed(1).replace('.', ',')}tr`;
            sjcNote = 'SJC Live';
            resolvedSjc = true;
          }
        }
      } catch {
        // fallback to global gold proxy change
      }

      try {
        const goldChart = await fetchYahooChartRaw('GC=F', '5d');
        const bars = parseYahooBars(goldChart);
        const lastBar = bars[bars.length - 1];
        const prevBar = bars[bars.length - 2];
        const val = Number(goldChart.meta?.regularMarketPrice ?? lastBar?.close ?? 0);
        const prev = Number(prevBar?.close ?? goldChart.meta?.chartPreviousClose ?? val);
        if (val > 0 && prev > 0) {
          sjcChangePct = Number((((val - prev) / prev) * 100).toFixed(2));
          if (!resolvedSjc) {
            const estSjcMil = Math.max(75, Math.min(125, (val * 1.20565 * 25.4) / 1000 + 8.5));
            sjcText = `${estSjcMil.toFixed(1).replace('.', ',')}tr`;
            sjcNote = 'Quy đổi XAU/VNĐ';
          }
        }
      } catch {
        // keep safe fallback
      }
    })(),
  ]);

  const result: MacroQuoteItem[] = [
    {
      id: 'USD/VND',
      valueText: usdRate.toLocaleString('vi-VN'),
      changePct: usdChangePct,
      sourceNote: usdNote,
    },
    {
      id: 'Vàng SJC',
      valueText: sjcText,
      changePct: sjcChangePct,
      sourceNote: sjcNote,
    },
  ];

  macroBenchmarksCache = { data: result, expiresAt: Date.now() + 5 * 60_000 };
  return result;
}

interface VpsQuoteRaw {
  sym?: string;
  c?: number | string;
  f?: number | string;
  r?: number | string;
  lastPrice?: number | string;
  closePrice?: number | string;
  lot?: number | string;
  fBVol?: number | string;
  fSVolume?: number | string;
  marketId?: string;
}

function mapVpsMarket(marketId: string | undefined, fallback: MarketExchange): MarketExchange {
  const m = String(marketId || '').toUpperCase();
  if (m === 'STX') return 'HNX';
  if (m === 'UPX') return 'UPCOM';
  if (m === 'STO') return 'HOSE';
  return fallback;
}

async function fetchVpsQuotesBatch(
  symbols: string[],
  directory: SsiSecurityItem[]
): Promise<Record<string, StockQuoteSnapshot>> {
  const cleanSyms = Array.from(
    new Set(symbols.map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z0-9]{1,12}$/.test(s)))
  ).slice(0, 20);
  if (cleanSyms.length === 0) return {};

  const toDate = formatVnDateDDMMYYYY(0);
  const start = Date.now();
  const url = `https://bgapidatafeed.vps.com.vn/getliststockdata/${cleanSyms.join(',')}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LangKinhFinance/1.0)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(6500),
    });

    const rows = (await res.json().catch(() => [])) as VpsQuoteRaw[];
    recordApiCall({
      apiId: 'yahoo_vn',
      endpoint: `/vps/getliststockdata (${cleanSyms.length} mã)`,
      statusCode: res.status,
      ok: res.ok && Array.isArray(rows) && rows.length > 0,
      latencyMs: Date.now() - start,
    });

    if (!res.ok || !Array.isArray(rows)) return {};

    const dirMap = new Map(directory.map((d) => [d.symbol, d]));
    const result: Record<string, StockQuoteSnapshot> = {};

    for (const row of rows) {
      const sym = String(row.sym || '').trim().toUpperCase();
      if (!sym) continue;
      const meta = dirMap.get(sym) || {
        symbol: sym,
        exchange: 'HOSE' as MarketExchange,
        companyName: sym,
      };
      const exchange = mapVpsMarket(row.marketId, meta.exchange);

      // VPS returns prices in thousands of VND (e.g., 19.85 => 19,850 đ)
      const refRaw = Number(row.r || 0);
      const lastRaw = Number(row.lastPrice || 0);
      const closeRaw = Number(row.closePrice || 0);
      const priceThousand = lastRaw > 0 ? lastRaw : refRaw > 0 ? refRaw : closeRaw / 1000;
      if (priceThousand <= 0) continue;

      const price = Math.round(priceThousand * 1000);
      const refPrice = Math.round((refRaw > 0 ? refRaw : priceThousand) * 1000);
      const ceilRaw = Number(row.c || 0);
      const floorRaw = Number(row.f || 0);
      const bands = calcBandLimits(refPrice, exchange);
      const ceilingPrice = ceilRaw > 0 ? Math.round(ceilRaw * 1000) : bands.ceilingPrice;
      const floorPrice = floorRaw > 0 ? Math.round(floorRaw * 1000) : bands.floorPrice;

      const change = price - refPrice;
      const changePct = refPrice > 0 ? Number(((change / refPrice) * 100).toFixed(2)) : 0;
      const volume = Math.max(0, Math.round(Number(row.lot || 0) * 10));
      const foreignBuyVol = Math.max(0, Math.round(Number(row.fBVol || 0) * 10));
      const foreignSellVol = Math.max(0, Math.round(Number(row.fSVolume || 0) * 10));
      const foreignNetVol = foreignBuyVol - foreignSellVol;

      const snapshot: StockQuoteSnapshot = {
        symbol: sym,
        exchange,
        companyName: meta.companyName,
        price,
        refPrice,
        ceilingPrice,
        floorPrice,
        change,
        changePct,
        volume,
        valueVnd: price * volume,
        foreignBuyVol,
        foreignSellVol,
        foreignNetVol,
        tradingDate: toDate,
        sourceMode: 'fallback',
      };
      quoteCache.set(sym, { data: snapshot, expiresAt: Date.now() + 60_000 });
      result[sym] = snapshot;
    }

    return result;
  } catch {
    recordApiCall({
      apiId: 'yahoo_vn',
      endpoint: `/vps/getliststockdata (${cleanSyms.length} mã)`,
      statusCode: 0,
      ok: false,
      latencyMs: Date.now() - start,
      detail: 'VPS batch fallback timeout/error',
    });
    return {};
  }
}

export async function getStockQuote(
  rawSymbol: string,
  catalog?: SsiSecurityItem[]
): Promise<StockQuoteSnapshot | null> {
  const symbol = rawSymbol.trim().toUpperCase();
  if (!symbol) return null;

  const cached = quoteCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const directory = catalog || (await getSecuritiesCatalog()).items;
  const meta = directory.find((s) => s.symbol === symbol) || {
    symbol,
    exchange: 'HOSE' as MarketExchange,
    companyName: symbol,
  };

  const creds = resolveSsiCredentials();
  const fromDate = formatVnDateDDMMYYYY(-10);
  const toDate = formatVnDateDDMMYYYY(0);

  if (creds.source !== 'none') {
    try {
      const rows = await fetchSsiEndpoint<Record<string, unknown>>('DailyStockPrice', {
        Symbol: symbol,
        Market: meta.exchange,
        FromDate: fromDate,
        ToDate: toDate,
        PageIndex: 1,
        PageSize: 10,
      });

      const latest = rows[rows.length - 1] || rows[0];
      if (latest) {
        const price = readNum(latest, ['ClosePrice', 'LastPrice', 'MatchedPrice', 'Close']);
        const refPrice = readNum(latest, ['RefPrice', 'PriorClosePrice', 'ReferencePrice'], price);
        const ceilingPrice = readNum(
          latest,
          ['CeilingPrice', 'Ceiling'],
          calcBandLimits(refPrice, meta.exchange).ceilingPrice
        );
        const floorPrice = readNum(
          latest,
          ['FloorPrice', 'Floor'],
          calcBandLimits(refPrice, meta.exchange).floorPrice
        );
        const change = readNum(latest, ['PriceChange', 'Change'], price - refPrice);
        const changePct =
          readNum(latest, ['PerPriceChange', 'RatioChange', 'PerChange']) ||
          (refPrice > 0 ? Number(((change / refPrice) * 100).toFixed(2)) : 0);
        const volume = readNum(latest, [
          'TotalMatchVol',
          'TotalTradedQtty',
          'TotalVolume',
          'Volume',
        ]);
        const valueVnd = readNum(latest, ['TotalMatchVal', 'TotalTradedValue', 'Value']);
        const foreignBuyVol = readNum(latest, ['BuyForeignQtty', 'ForeignBuyVol', 'FBuyVol']);
        const foreignSellVol = readNum(latest, ['SellForeignQtty', 'ForeignSellVol', 'FSellVol']);
        const foreignNetVol =
          readNum(latest, ['NetBuySellVol', 'ForeignNetVol']) ||
          foreignBuyVol - foreignSellVol;
        const tradingDate = readStr(latest, ['TradingDate', 'Date'], toDate);

        if (price > 0) {
          const snapshot: StockQuoteSnapshot = {
            symbol,
            exchange: meta.exchange,
            companyName: meta.companyName,
            price: Math.round(price),
            refPrice: Math.round(refPrice),
            ceilingPrice: Math.round(ceilingPrice),
            floorPrice: Math.round(floorPrice),
            change: Math.round(change),
            changePct: Number(changePct.toFixed(2)),
            volume: Math.round(volume),
            valueVnd: Math.round(valueVnd || price * volume),
            foreignBuyVol: Math.round(foreignBuyVol),
            foreignSellVol: Math.round(foreignSellVol),
            foreignNetVol: Math.round(foreignNetVol),
            tradingDate,
            sourceMode: 'ssi',
          };
          quoteCache.set(symbol, { data: snapshot, expiresAt: Date.now() + 60_000 });
          return snapshot;
        }
      }
    } catch {
      // Fallback below
    }
  }

  // Fallback 1: VPS real-time feed (supports HOSE + HNX + UPCOM + Foreign Net Flow)
  const vpsMap = await fetchVpsQuotesBatch([symbol], directory);
  if (vpsMap[symbol]) {
    return vpsMap[symbol];
  }

  // Fallback 2: Yahoo Finance .VN chart
  try {
    const chart = await fetchYahooChartRaw(`${symbol}.VN`, '1mo');
    const bars = parseYahooBars(chart);
    const lastBar = bars[bars.length - 1];
    const prevBar = bars[bars.length - 2];
    const price = Math.round(Number(chart.meta?.regularMarketPrice ?? lastBar?.close ?? 0));
    const refPrice = Math.round(
      Number(prevBar?.close ?? chart.meta?.chartPreviousClose ?? price)
    );
    if (price <= 0) return null;
    const change = price - refPrice;
    const changePct = refPrice > 0 ? Number(((change / refPrice) * 100).toFixed(2)) : 0;
    const { ceilingPrice, floorPrice } = calcBandLimits(refPrice, meta.exchange);
    const volume = Math.round(
      Number(chart.meta?.regularMarketVolume ?? lastBar?.volume ?? 0)
    );

    const snapshot: StockQuoteSnapshot = {
      symbol,
      exchange: meta.exchange,
      companyName: meta.companyName,
      price,
      refPrice,
      ceilingPrice,
      floorPrice,
      change,
      changePct,
      volume,
      valueVnd: price * volume,
      foreignBuyVol: 0,
      foreignSellVol: 0,
      foreignNetVol: 0,
      tradingDate: lastBar?.date || toDate,
      sourceMode: 'fallback',
    };
    quoteCache.set(symbol, { data: snapshot, expiresAt: Date.now() + 60_000 });
    return snapshot;
  } catch {
    return null;
  }
}

export async function getMultipleStockQuotes(
  symbols: string[]
): Promise<Record<string, StockQuoteSnapshot>> {
  const unique = Array.from(
    new Set(
      symbols
        .map((s) => s.trim().toUpperCase())
        .filter((s) => /^[A-Z0-9]{1,12}$/.test(s))
    )
  ).slice(0, 20);

  if (unique.length === 0) return {};
  const catalog = (await getSecuritiesCatalog()).items;
  const map: Record<string, StockQuoteSnapshot> = {};
  const needFetch: string[] = [];

  for (const sym of unique) {
    const cached = quoteCache.get(sym);
    if (cached && cached.expiresAt > Date.now()) {
      map[sym] = cached.data;
    } else {
      needFetch.push(sym);
    }
  }

  if (needFetch.length === 0) return map;

  const creds = resolveSsiCredentials();
  let stillMissing = [...needFetch];

  if (creds.source !== 'none') {
    const settledSsi = await Promise.allSettled(
      needFetch.map((sym) => getStockQuote(sym, catalog))
    );
    stillMissing = [];
    for (let i = 0; i < needFetch.length; i += 1) {
      const r = settledSsi[i];
      if (r.status === 'fulfilled' && r.value) {
        map[needFetch[i]] = r.value;
      } else {
        stillMissing.push(needFetch[i]);
      }
    }
  } else {
    // Batch-fetch via VPS first so HOSE + HNX + UPCOM resolve in 1 fast call
    const vpsQuotes = await fetchVpsQuotesBatch(stillMissing, catalog);
    const remaining: string[] = [];
    for (const sym of stillMissing) {
      if (vpsQuotes[sym]) {
        map[sym] = vpsQuotes[sym];
      } else {
        remaining.push(sym);
      }
    }
    stillMissing = remaining;
  }

  if (stillMissing.length > 0) {
    const settledFallback = await Promise.allSettled(
      stillMissing.map((sym) => getStockQuote(sym, catalog))
    );
    for (let i = 0; i < stillMissing.length; i += 1) {
      const r = settledFallback[i];
      if (r.status === 'fulfilled' && r.value) {
        map[stillMissing[i]] = r.value;
      }
    }
  }

  return map;
}

export function enrichOhlcAndComputeIndicators(
  rawBars: OhlcBar[],
  displayLimit = 120
): {
  ohlc: OhlcBar[];
  indicators: TechnicalIndicatorsSnapshot;
} {
  const fullBars = rawBars.slice(-180).map((b) => ({ ...b }));
  const closes = fullBars.map((b) => b.close);
  const volumes = fullBars.map((b) => b.volume || 0);

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < fullBars.length; i += 1) {
    if (i >= 19) {
      const slice20 = closes.slice(i - 19, i + 1);
      const mean20 = slice20.reduce((acc, v) => acc + v, 0) / 20;
      const variance =
        slice20.reduce((acc, v) => acc + (v - mean20) * (v - mean20), 0) / 20;
      const stdDev = Math.sqrt(variance);
      fullBars[i].ma20 = Math.round(mean20);
      fullBars[i].bbMiddle = Math.round(mean20);
      fullBars[i].bbUpper = Math.round(mean20 + 2 * stdDev);
      fullBars[i].bbLower = Math.max(0, Math.round(mean20 - 2 * stdDev));

      const volSlice = volumes.slice(i - 19, i + 1);
      fullBars[i].volMa20 = Math.round(
        volSlice.reduce((acc, v) => acc + v, 0) / 20
      );
    } else {
      fullBars[i].ma20 = null;
      fullBars[i].bbMiddle = null;
      fullBars[i].bbUpper = null;
      fullBars[i].bbLower = null;
      fullBars[i].volMa20 = null;
    }

    if (i >= 49) {
      const slice50 = closes.slice(i - 49, i + 1);
      fullBars[i].ma50 = Math.round(slice50.reduce((acc, v) => acc + v, 0) / 50);
    } else {
      fullBars[i].ma50 = null;
    }

    if (i === 0) {
      fullBars[i].rsi14 = null;
      continue;
    }
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    if (i < 14) {
      avgGain += gain;
      avgLoss += loss;
      fullBars[i].rsi14 = null;
    } else if (i === 14) {
      avgGain = (avgGain + gain) / 14;
      avgLoss = (avgLoss + loss) / 14;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      fullBars[i].rsi14 = Number((100 - 100 / (1 + rs)).toFixed(1));
    } else {
      avgGain = (avgGain * 13 + gain) / 14;
      avgLoss = (avgLoss * 13 + loss) / 14;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      fullBars[i].rsi14 = Number((100 - 100 / (1 + rs)).toFixed(1));
    }
  }

  const bars = fullBars.slice(-displayLimit);
  const latest = bars[bars.length - 1];
  const recent20 = bars.slice(-20);
  const lows = recent20.map((b) => b.low).filter((v) => v > 0);
  const highs = recent20.map((b) => b.high).filter((v) => v > 0);
  const support = lows.length > 0 ? Math.round(Math.min(...lows)) : 0;
  const resistance = highs.length > 0 ? Math.round(Math.max(...highs)) : 0;

  const avgVol20 =
    recent20.length > 0
      ? recent20.reduce((acc, b) => acc + b.volume, 0) / recent20.length
      : 0;
  const volumeRatio20 =
    latest && avgVol20 > 0 ? Number((latest.volume / avgVol20).toFixed(2)) : null;

  const ma20 = latest?.ma20 ?? null;
  const ma50 = latest?.ma50 ?? null;
  const rsi14 = latest?.rsi14 ?? null;
  const priceVsMa20Pct =
    latest && ma20 && ma20 > 0
      ? Number((((latest.close - ma20) / ma20) * 100).toFixed(2))
      : null;

  let trendSignal: TechnicalIndicatorsSnapshot['trendSignal'] = 'Tích lũy';
  if (
    priceVsMa20Pct !== null &&
    priceVsMa20Pct > 1.2 &&
    (rsi14 === null || rsi14 >= 52)
  ) {
    trendSignal = 'Tăng';
  } else if (
    (priceVsMa20Pct !== null && priceVsMa20Pct < -1.5) ||
    (rsi14 !== null && rsi14 < 42)
  ) {
    trendSignal = 'Suy yếu';
  }

  return {
    ohlc: bars,
    indicators: {
      ma20,
      ma50,
      bbUpper: latest?.bbUpper ?? null,
      bbMiddle: latest?.bbMiddle ?? null,
      bbLower: latest?.bbLower ?? null,
      volMa20: latest?.volMa20 ?? (avgVol20 > 0 ? Math.round(avgVol20) : null),
      rsi14,
      support,
      resistance,
      priceVsMa20Pct,
      volumeRatio20,
      trendSignal,
    },
  };
}

export function detectReversalSignals(bars: OhlcBar[]): ReversalSignalItem[] {
  const signals: ReversalSignalItem[] = [];
  if (bars.length < 22) return signals;

  const lookbackStart = Math.max(2, bars.length - 36);

  // 1. RSI Divergence (Bullish & Bearish) across pivot swing lows/highs
  const swingLows: Array<{ idx: number; low: number; rsi: number; date: string }> = [];
  const swingHighs: Array<{ idx: number; high: number; rsi: number; date: string }> = [];

  for (let i = lookbackStart; i < bars.length - 1; i += 1) {
    const prev = bars[i - 1];
    const curr = bars[i];
    const next = bars[i + 1];
    if (curr.rsi14 === null || curr.rsi14 === undefined) continue;

    if (curr.low <= prev.low && curr.low <= next.low) {
      swingLows.push({ idx: i, low: curr.low, rsi: curr.rsi14, date: curr.date });
    }
    if (curr.high >= prev.high && curr.high >= next.high) {
      swingHighs.push({ idx: i, high: curr.high, rsi: curr.rsi14, date: curr.date });
    }
  }

  if (swingLows.length >= 2) {
    const recentLow = swingLows[swingLows.length - 1];
    const priorLow = swingLows[swingLows.length - 2];
    if (
      recentLow.idx - priorLow.idx >= 3 &&
      recentLow.low < priorLow.low * 0.996 &&
      recentLow.rsi > priorLow.rsi + 2 &&
      priorLow.rsi <= 48
    ) {
      signals.push({
        id: `sig-rsi-bull-${recentLow.date}`,
        date: recentLow.date,
        type: 'rsi_bullish_div',
        direction: 'bullish',
        label: 'Phân kỳ dương RSI',
        price: recentLow.low,
        description: `Giá tạo đáy thấp hơn (${recentLow.low.toLocaleString('vi-VN')} < ${priorLow.low.toLocaleString('vi-VN')}) nhưng RSI(14) tạo đáy cao hơn (${recentLow.rsi} > ${priorLow.rsi}) → tín hiệu đảo chiều tăng.`,
        strength: recentLow.rsi - priorLow.rsi >= 5 ? 'Cao' : 'Trung bình',
      });
    }
  }

  if (swingHighs.length >= 2) {
    const recentHigh = swingHighs[swingHighs.length - 1];
    const priorHigh = swingHighs[swingHighs.length - 2];
    if (
      recentHigh.idx - priorHigh.idx >= 3 &&
      recentHigh.high > priorHigh.high * 1.004 &&
      recentHigh.rsi < priorHigh.rsi - 2 &&
      priorHigh.rsi >= 54
    ) {
      signals.push({
        id: `sig-rsi-bear-${recentHigh.date}`,
        date: recentHigh.date,
        type: 'rsi_bearish_div',
        direction: 'bearish',
        label: 'Phân kỳ âm RSI',
        price: recentHigh.high,
        description: `Giá tạo đỉnh cao hơn (${recentHigh.high.toLocaleString('vi-VN')} > ${priorHigh.high.toLocaleString('vi-VN')}) nhưng RSI(14) suy yếu (${recentHigh.rsi} < ${priorHigh.rsi}) → cảnh báo đảo chiều giảm.`,
        strength: priorHigh.rsi - recentHigh.rsi >= 5 ? 'Cao' : 'Trung bình',
      });
    }
  }

  // 2. MA20 / Golden Cross + Volume Breakout (>150% VolMA20) in recent 15 bars
  const recentStart = Math.max(1, bars.length - 15);
  for (let i = bars.length - 1; i >= recentStart; i -= 1) {
    const b = bars[i];
    const prev = bars[i - 1];
    const volAvg = b.volMa20 || 0;
    const crossUpMa20 =
      b.ma20 && prev.ma20 && prev.close <= prev.ma20 && b.close > b.ma20;
    const goldenCross =
      b.ma20 && b.ma50 && prev.ma20 && prev.ma50 && prev.ma20 <= prev.ma50 && b.ma20 > b.ma50;
    const volBreak = volAvg > 0 && b.volume >= volAvg * 1.5;

    if ((crossUpMa20 && volBreak) || goldenCross) {
      const volMult = volAvg > 0 ? (b.volume / volAvg).toFixed(1) : '1.5';
      signals.push({
        id: `sig-gcross-${b.date}`,
        date: b.date,
        type: 'golden_cross_vol',
        direction: 'bullish',
        label: goldenCross ? 'Giao cắt vàng MA20/MA50' : 'Vượt MA20 + KL đột biến',
        price: b.close,
        description: goldenCross
          ? `MA20 (${b.ma20?.toLocaleString('vi-VN')}) cắt lên trên MA50 (${b.ma50?.toLocaleString('vi-VN')}) xác nhận xu hướng tăng trung hạn.`
          : `Giá bứt phá vượt MA20 (${b.ma20?.toLocaleString('vi-VN')} đ) đi kèm khối lượng đột biến ${volMult}x trung bình 20 phiên.`,
        strength: volBreak ? 'Cao' : 'Trung bình',
      });
      break;
    }
  }

  // 3. Reversal Candles (Hammer/Pinbar & Bullish/Bearish Engulfing) near short-term S/R
  for (let i = bars.length - 1; i >= Math.max(5, bars.length - 8); i -= 1) {
    const b = bars[i];
    const prev = bars[i - 1];
    const windowLow = Math.min(...bars.slice(Math.max(0, i - 14), i + 1).map((x) => x.low));
    const windowHigh = Math.max(...bars.slice(Math.max(0, i - 14), i + 1).map((x) => x.high));
    const body = Math.abs(b.close - b.open);
    const range = Math.max(1, b.high - b.low);
    const lowerWick = Math.min(b.open, b.close) - b.low;
    const upperWick = b.high - Math.max(b.open, b.close);

    const nearSupport = b.low <= windowLow * 1.02;
    const nearResistance = b.high >= windowHigh * 0.985;

    if (
      nearSupport &&
      lowerWick >= Math.max(body * 1.8, range * 0.45) &&
      upperWick <= Math.max(body * 0.8, range * 0.25)
    ) {
      signals.push({
        id: `sig-hammer-${b.date}`,
        date: b.date,
        type: 'hammer_support',
        direction: 'bullish',
        label: 'Nến Rút chân (Hammer) tại Hỗ trợ',
        price: b.close,
        description: `Xuất hiện nến rút chân hấp thụ lực cung quanh vùng hỗ trợ ${windowLow.toLocaleString('vi-VN')} đ, đóng cửa ${b.close.toLocaleString('vi-VN')} đ.`,
        strength: 'Trung bình',
      });
      break;
    }

    const bullishEngulfing =
      prev.close < prev.open &&
      b.close > b.open &&
      b.close >= prev.open &&
      b.open <= prev.close &&
      body > Math.abs(prev.close - prev.open) * 1.05;

    if (nearSupport && bullishEngulfing) {
      signals.push({
        id: `sig-engulf-bull-${b.date}`,
        date: b.date,
        type: 'engulfing_bull',
        direction: 'bullish',
        label: 'Nhấn chìm tăng (Bullish Engulfing)',
        price: b.close,
        description: `Nến tăng bao trùm hoàn toàn thân nến giảm trước đó tại vùng đáy ngắn hạn ${windowLow.toLocaleString('vi-VN')} đ.`,
        strength: 'Cao',
      });
      break;
    }

    const bearishEngulfing =
      prev.close > prev.open &&
      b.close < b.open &&
      b.open >= prev.close &&
      b.close <= prev.open &&
      body > Math.abs(prev.close - prev.open) * 1.05;

    if (nearResistance && bearishEngulfing) {
      signals.push({
        id: `sig-engulf-bear-${b.date}`,
        date: b.date,
        type: 'engulfing_bear',
        direction: 'bearish',
        label: 'Nhấn chìm giảm (Bearish Engulfing)',
        price: b.close,
        description: `Áp lực chốt lời nhấn chìm cây nến tăng trước tại vùng kháng cự ${windowHigh.toLocaleString('vi-VN')} đ.`,
        strength: 'Cao',
      });
      break;
    }
  }

  return signals.slice(0, 6);
}

export function computeRiskRewardStats(
  bars: OhlcBar[],
  indicators: TechnicalIndicatorsSnapshot,
  reversals: ReversalSignalItem[]
): RiskRewardSummary {
  const sampleBars = bars.slice(-120);
  const lastClose = sampleBars[sampleBars.length - 1]?.close || 10000;

  // Backtest 5-bar forward return on historical setups matching current regime
  const lookAhead = 5;
  let matchedCount = 0;
  let wins = 0;
  const isBullRegime =
    indicators.trendSignal === 'Tăng' ||
    reversals.some((r) => r.direction === 'bullish');

  for (let i = 20; i < sampleBars.length - lookAhead; i += 1) {
    const b = sampleBars[i];
    const prev = sampleBars[i - 1];
    const rsi = b.rsi14 ?? 50;
    const ma20 = b.ma20 ?? b.close;
    const volAvg = b.volMa20 ?? b.volume;

    const triggerBull =
      (b.close > ma20 && prev.close <= (prev.ma20 ?? prev.close)) ||
      (rsi >= 45 && rsi <= 66 && b.volume >= volAvg * 1.15) ||
      rsi <= 36;
    const triggerBear = rsi >= 68 || b.close < ma20 * 0.97;

    if (isBullRegime ? triggerBull : triggerBear) {
      matchedCount += 1;
      const futureClose = sampleBars[i + lookAhead].close;
      const fwdRet = (futureClose - b.close) / Math.max(1, b.close);
      if (fwdRet > 0.008) wins += 1;
    }
  }

  let winProbabilityPct =
    matchedCount >= 4 ? Math.round((wins / matchedCount) * 100) : 54;
  if (reversals.some((r) => r.direction === 'bullish')) winProbabilityPct += 6;
  if (reversals.some((r) => r.direction === 'bearish')) winProbabilityPct -= 7;
  winProbabilityPct = Math.max(28, Math.min(82, winProbabilityPct));

  // ATR(14) for mathematically sound TP/SL
  let atrSum = 0;
  let atrCount = 0;
  for (let i = Math.max(1, sampleBars.length - 14); i < sampleBars.length; i += 1) {
    const cur = sampleBars[i];
    const prev = sampleBars[i - 1];
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close)
    );
    atrSum += tr;
    atrCount += 1;
  }
  const atr = atrCount > 0 ? atrSum / atrCount : lastClose * 0.022;

  const roundPrice = (v: number) => Math.max(100, Math.round(v / 50) * 50);

  const rawSl = Math.min(
    lastClose - atr * 1.55,
    indicators.support > 0 && indicators.support < lastClose * 0.985
      ? indicators.support * 0.99
      : lastClose * 0.955
  );
  const slPrice = roundPrice(Math.max(lastClose * 0.88, Math.min(lastClose * 0.975, rawSl)));

  const rawTp1 = Math.max(
    lastClose + atr * 2.3,
    indicators.resistance > lastClose * 1.02 ? indicators.resistance : lastClose * 1.055
  );
  const tp1Price = roundPrice(rawTp1);
  const tp2Price = roundPrice(
    Math.max(tp1Price + atr * 1.5, indicators.bbUpper || lastClose * 1.11)
  );

  const slPct = Number((((slPrice - lastClose) / lastClose) * 100).toFixed(2));
  const tp1Pct = Number((((tp1Price - lastClose) / lastClose) * 100).toFixed(2));
  const tp2Pct = Number((((tp2Price - lastClose) / lastClose) * 100).toFixed(2));

  const riskDenom = Math.max(100, lastClose - slPrice);
  const rewardNum = Math.max(100, tp1Price - lastClose);
  const riskRewardRatio = Number((rewardNum / riskDenom).toFixed(2));

  const basisParts = [
    `${sampleBars.length} nến lịch sử`,
    `${matchedCount} mẫu hình tương đồng`,
  ];
  if (reversals.length > 0) {
    basisParts.push(`Tín hiệu mới: ${reversals[0].label}`);
  }

  return {
    sampleSessions: sampleBars.length,
    sampleSignalsCount: matchedCount,
    winProbabilityPct,
    tp1Price,
    tp1Pct,
    tp2Price,
    tp2Pct,
    slPrice,
    slPct,
    riskRewardRatio,
    signalBasis: basisParts.join(' · '),
  };
}

export async function getDailyOhlcHistory(
  rawSymbol: string,
  days = 120,
  timeframe: ChartTimeframe = '1D'
): Promise<{
  ohlc: OhlcBar[];
  indicators: TechnicalIndicatorsSnapshot;
  reversalSignals: ReversalSignalItem[];
  riskReward: RiskRewardSummary;
  sourceMode: MarketDataSourceMode;
}> {
  const symbol = rawSymbol.trim().toUpperCase();
  const cacheKey = `${symbol}::${timeframe}::${days}`;
  const cached = ohlcCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    const computed = enrichOhlcAndComputeIndicators(cached.data, days);
    const reversalSignals = detectReversalSignals(computed.ohlc);
    const riskReward = computeRiskRewardStats(
      computed.ohlc,
      computed.indicators,
      reversalSignals
    );
    return {
      ...computed,
      reversalSignals,
      riskReward,
      sourceMode: resolveSsiCredentials().source !== 'none' ? 'ssi' : 'fallback',
    };
  }

  const creds = resolveSsiCredentials();
  if (creds.source !== 'none') {
    try {
      if (timeframe === 'intraday') {
        const rows = await fetchSsiEndpoint<Record<string, unknown>>('IntradayOhlc', {
          Symbol: symbol,
          FromDate: formatVnDateDDMMYYYY(-3),
          ToDate: formatVnDateDDMMYYYY(0),
          PageIndex: 1,
          PageSize: 120,
          Ascending: true,
          Resolution: 15,
        });
        const parsed: OhlcBar[] = rows
          .map((r) => {
            const rawDate = readStr(r, ['TradingDate', 'Date']);
            const rawTime = readStr(r, ['Time', 'TradingTime']);
            const close = readNum(r, ['Close', 'ClosePrice', 'Value']);
            const open = readNum(r, ['Open', 'OpenPrice'], close);
            const high = readNum(r, ['High', 'HighPrice'], close);
            const low = readNum(r, ['Low', 'LowPrice'], close);
            const volume = readNum(r, ['Volume', 'TotalMatchVol', 'TotalVol']);
            return {
              date: rawTime ? `${rawDate.slice(0, 5)} ${rawTime.slice(0, 5)}` : rawDate,
              open: Math.round(open),
              high: Math.round(high),
              low: Math.round(low),
              close: Math.round(close),
              volume: Math.round(volume),
            };
          })
          .filter((b) => b.close > 0)
          .slice(-90);

        if (parsed.length >= 10) {
          ohlcCache.set(cacheKey, { data: parsed, expiresAt: Date.now() + 2 * 60_000 });
          const computed = enrichOhlcAndComputeIndicators(parsed, 90);
          const reversalSignals = detectReversalSignals(computed.ohlc);
          const riskReward = computeRiskRewardStats(
            computed.ohlc,
            computed.indicators,
            reversalSignals
          );
          return { ...computed, reversalSignals, riskReward, sourceMode: 'ssi' };
        }
      } else {
        const lookbackDays = timeframe === '1W' || timeframe === '3M' ? -280 : -200;
        const rows = await fetchSsiEndpoint<Record<string, unknown>>('DailyOhlc', {
          Symbol: symbol,
          FromDate: formatVnDateDDMMYYYY(lookbackDays),
          ToDate: formatVnDateDDMMYYYY(0),
          PageIndex: 1,
          PageSize: 200,
          Ascending: true,
        });

        const parsed: OhlcBar[] = rows
          .map((r) => {
            const rawDate = readStr(r, ['TradingDate', 'Date']);
            const close = readNum(r, ['Close', 'ClosePrice']);
            const open = readNum(r, ['Open', 'OpenPrice'], close);
            const high = readNum(r, ['High', 'HighPrice'], close);
            const low = readNum(r, ['Low', 'LowPrice'], close);
            const volume = readNum(r, ['Volume', 'TotalMatchVol', 'TotalVol']);
            let isoDate = rawDate;
            const dmY = rawDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (dmY) {
              isoDate = `${dmY[3]}-${dmY[2]}-${dmY[1]}`;
            }
            return {
              date: isoDate,
              open: Math.round(open),
              high: Math.round(high),
              low: Math.round(low),
              close: Math.round(close),
              volume: Math.round(volume),
            };
          })
          .filter((b) => b.close > 0);

        if (parsed.length >= 10) {
          const displayCount =
            timeframe === '1M' ? 30 : timeframe === '3M' ? 90 : timeframe === '1W' ? 75 : 120;
          ohlcCache.set(cacheKey, { data: parsed, expiresAt: Date.now() + 5 * 60_000 });
          const computed = enrichOhlcAndComputeIndicators(parsed, displayCount);
          const reversalSignals = detectReversalSignals(computed.ohlc);
          const riskReward = computeRiskRewardStats(
            computed.ohlc,
            computed.indicators,
            reversalSignals
          );
          return { ...computed, reversalSignals, riskReward, sourceMode: 'ssi' };
        }
      }
    } catch {
      // Fallback below
    }
  }

  let range = '6mo';
  let interval = '1d';
  let displayLimit = days;
  let isIntraday = false;

  if (timeframe === 'intraday') {
    range = '5d';
    interval = '15m';
    displayLimit = 80;
    isIntraday = true;
  } else if (timeframe === '1W') {
    range = '2y';
    interval = '1wk';
    displayLimit = 80;
  } else if (timeframe === '1M') {
    range = '6mo';
    interval = '1d';
    displayLimit = 35;
  } else if (timeframe === '3M') {
    range = '1y';
    interval = '1d';
    displayLimit = 90;
  } else {
    range = '1y';
    interval = '1d';
    displayLimit = Math.max(90, days);
  }

  const fetchVnDirectBars = async (): Promise<OhlcBar[]> => {
    const size = timeframe === '1W' ? 220 : Math.max(120, displayLimit + 60);
    const start = Date.now();
    try {
      const finfoUrl = `https://api-finfo.vndirect.com.vn/v4/stock_prices?sort=date&q=code:${encodeURIComponent(
        symbol
      )}&size=${size}`;
      const res = await fetch(finfoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LangKinhFinance/1.0)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(7000),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: Array<{
          date?: string;
          open?: number;
          high?: number;
          low?: number;
          close?: number;
          adOpen?: number;
          adHigh?: number;
          adLow?: number;
          adClose?: number;
          nmVolume?: number;
        }>;
      };
      recordApiCall({
        apiId: 'yahoo_vn',
        endpoint: `/vndirect/stock_prices (${symbol})`,
        statusCode: res.status,
        ok: res.ok && Array.isArray(json.data) && json.data.length > 0,
        latencyMs: Date.now() - start,
      });

      if (res.ok && Array.isArray(json.data) && json.data.length > 0) {
        return json.data
          .slice()
          .reverse()
          .map((d) => {
            const close = Number(d.close || d.adClose || 0) * 1000;
            const open = Number(d.open || d.adOpen || d.close || 0) * 1000;
            const high = Number(d.high || d.adHigh || d.close || 0) * 1000;
            const low = Number(d.low || d.adLow || d.close || 0) * 1000;
            return {
              date: String(d.date || ''),
              open: Math.round(open),
              high: Math.round(high),
              low: Math.round(low),
              close: Math.round(close),
              volume: Math.max(0, Math.round(Number(d.nmVolume || 0))),
            };
          })
          .filter((b) => b.close > 0 && b.date.length > 0);
      }
    } catch {
      recordApiCall({
        apiId: 'yahoo_vn',
        endpoint: `/vndirect/stock_prices (${symbol})`,
        statusCode: 0,
        ok: false,
        latencyMs: Date.now() - start,
      });
    }
    return [];
  };

  const tryYahooBars = async (): Promise<OhlcBar[]> => {
    const missingExp = yahooMissingCache.get(symbol);
    if (missingExp && missingExp > Date.now()) {
      return [];
    }
    try {
      const chart = await fetchYahooChartRaw(`${symbol}.VN`, range, interval);
      return parseYahooBars(chart, isIntraday);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/404|not found|no data|delisted/i.test(msg)) {
        yahooMissingCache.set(symbol, Date.now() + 15 * 60_000);
      }
      return [];
    }
  };

  let bars: OhlcBar[] = [];
  if (!isIntraday && isVnDirectPreferredExchange(symbol)) {
    bars = await fetchVnDirectBars();
    if (bars.length < 10) {
      const yBars = await tryYahooBars();
      if (yBars.length > bars.length) bars = yBars;
    }
  } else {
    bars = await tryYahooBars();
    if (bars.length < 10) {
      const vBars = await fetchVnDirectBars();
      if (vBars.length > bars.length) bars = vBars;
    }
  }

  if (bars.length === 0) {
    throw new Error(`Không tìm thấy dữ liệu lịch sử giá cho mã ${symbol}.`);
  }

  ohlcCache.set(cacheKey, {
    data: bars,
    expiresAt: Date.now() + (isIntraday ? 2 : 5) * 60_000,
  });
  const computed = enrichOhlcAndComputeIndicators(bars, displayLimit);
  const reversalSignals = detectReversalSignals(computed.ohlc);
  const riskReward = computeRiskRewardStats(
    computed.ohlc,
    computed.indicators,
    reversalSignals
  );
  return { ...computed, reversalSignals, riskReward, sourceMode: 'fallback' };
}

const CFO_MISMATCH_PATTERNS = [
  /dòng tiền kinh doanh âm/i,
  /\bcfo âm\b/i,
  /\bfcf âm\b/i,
  /lệch pha.*dòng tiền/i,
  /lợi nhuận.*không tạo.*tiền/i,
  /phải thu tăng.*đột biến/i,
  /hàng tồn kho tăng mạnh/i,
  /thâm hụt dòng tiền/i,
  /âm dòng tiền/i,
];

export function detectCandlestickSignals(
  bars: OhlcBar[],
  recentNews: Array<{ title: string; summary?: string; impactLabel: FinanceArticleImpactLabel }> = []
): CandlestickSignalItem[] {
  if (bars.length < 6) return [];

  const bullNewsCount = recentNews.filter((n) => n.impactLabel === 'Hỗ trợ tăng').length;
  const bearNewsCount = recentNews.filter((n) => n.impactLabel === 'Rủi ro cao').length;
  const signals: CandlestickSignalItem[] = [];

  const roundVnd = (n: number) => Math.round(n).toLocaleString('vi-VN');
  const startIdx = Math.max(2, bars.length - 45);

  for (let i = startIdx; i < bars.length; i += 1) {
    const b = bars[i];
    const p1 = bars[i - 1];
    const p2 = bars[i - 2];

    const body = Math.abs(b.close - b.open);
    const range = Math.max(1, b.high - b.low);
    const upperWick = b.high - Math.max(b.open, b.close);
    const lowerWick = Math.min(b.open, b.close) - b.low;
    const isBull = b.close > b.open;
    const isBear = b.close < b.open;

    const p1Body = Math.abs(p1.close - p1.open);
    const p1Range = Math.max(1, p1.high - p1.low);
    const p1IsBull = p1.close > p1.open;
    const p1IsBear = p1.close < p1.open;

    const p2Body = Math.abs(p2.close - p2.open);
    const p2IsBull = p2.close > p2.open;
    const p2IsBear = p2.close < p2.open;

    const winSlice = bars.slice(Math.max(0, i - 10), i + 1);
    const winLow = Math.min(...winSlice.map((x) => x.low));
    const winHigh = Math.max(...winSlice.map((x) => x.high));
    const nearSupport = b.low <= winLow * 1.022 || (b.bbLower ? b.low <= b.bbLower * 1.015 : false);
    const nearResistance = b.high >= winHigh * 0.978 || (b.bbUpper ? b.high >= b.bbUpper * 0.985 : false);

    const volAvg = b.volMa20 || 0;
    const volRatio = volAvg > 0 ? b.volume / volAvg : 1;

    let detected: {
      patternId: CandlestickPatternId;
      patternName: string;
      signalType: 'BUY' | 'SELL';
      baseConf: number;
      reason: string;
    } | null = null;

    // 1. Three White Soldiers (Continuation Bullish)
    if (
      p2IsBull &&
      p1IsBull &&
      isBull &&
      p1.close > p2.close &&
      b.close > p1.close &&
      p2Body >= (p2.high - p2.low) * 0.45 &&
      p1Body >= p1Range * 0.45 &&
      body >= range * 0.45 &&
      b.open >= p1.open &&
      p1.open >= p2.open
    ) {
      detected = {
        patternId: 'three_white_soldiers',
        patternName: 'Three White Soldiers (3 Lính Trắng)',
        signalType: 'BUY',
        baseConf: 72,
        reason: `3 phiên nến tăng liên tiếp với thân đặc và giá đóng cửa tịnh tiến (${roundVnd(p2.close)} → ${roundVnd(p1.close)} → ${roundVnd(b.close)} đ), xác nhận xung lực cầu chủ động.`,
      };
    }
    // 2. Bullish Marubozu Breakout
    else if (
      isBull &&
      body >= range * 0.78 &&
      upperWick <= range * 0.12 &&
      lowerWick <= range * 0.12 &&
      b.close >= winHigh * 0.992 &&
      volRatio >= 1.25
    ) {
      detected = {
        patternId: 'marubozu_breakout',
        patternName: 'Bullish Marubozu Bứt Phá',
        signalType: 'BUY',
        baseConf: 70,
        reason: `Nến đặc tăng dứt khoát đóng cửa sát đỉnh phiên (${roundVnd(b.close)} đ) kèm thanh khoản ${volRatio.toFixed(1)}x TB20, bứt phá vùng tích lũy.`,
      };
    }
    // 3. Morning Star (3-candle bullish reversal)
    else if (
      p2IsBear &&
      p2Body >= (p2.high - p2.low) * 0.45 &&
      p1Body <= p1Range * 0.35 &&
      p1.close <= p2.close * 1.01 &&
      isBull &&
      b.close >= (p2.open + p2.close) / 2 &&
      nearSupport
    ) {
      detected = {
        patternId: 'morning_star',
        patternName: 'Morning Star (Sao Mai)',
        signalType: 'BUY',
        baseConf: 73,
        reason: `Cấu trúc 3 nến Sao Mai đảo chiều đáy: sau phiên giảm sâu và nến lưỡng lự thân nhỏ, nến tăng phục hồi vượt 50% thân nến giảm (${roundVnd(b.close)} đ).`,
      };
    }
    // 4. Evening Star (3-candle bearish reversal)
    else if (
      p2IsBull &&
      p2Body >= (p2.high - p2.low) * 0.45 &&
      p1Body <= p1Range * 0.35 &&
      p1.close >= p2.close * 0.99 &&
      isBear &&
      b.close <= (p2.open + p2.close) / 2 &&
      nearResistance
    ) {
      detected = {
        patternId: 'evening_star',
        patternName: 'Evening Star (Sao Hôm)',
        signalType: 'SELL',
        baseConf: 73,
        reason: `Cấu trúc 3 nến Sao Hôm tại vùng đỉnh ngắn hạn ${roundVnd(winHigh)} đ cho thấy động lượng tăng cạn kiệt và bên bán giành lại quyền kiểm soát.`,
      };
    }
    // 5. Bullish Engulfing
    else if (
      p1IsBear &&
      isBull &&
      b.close >= p1.open &&
      b.open <= p1.close &&
      body >= p1Body * 1.08 &&
      nearSupport
    ) {
      detected = {
        patternId: 'bullish_engulfing',
        patternName: 'Bullish Engulfing (Nhấn Chìm Tăng)',
        signalType: 'BUY',
        baseConf: 71,
        reason: `Thân nến tăng nuốt trọn thân nến giảm phiên trước quanh hỗ trợ ${roundVnd(winLow)} đ, phát tín hiệu hấp thụ hết lực cung ngắn hạn.`,
      };
    }
    // 6. Bearish Engulfing
    else if (
      p1IsBull &&
      isBear &&
      b.open >= p1.close &&
      b.close <= p1.open &&
      body >= p1Body * 1.08 &&
      nearResistance
    ) {
      detected = {
        patternId: 'bearish_engulfing',
        patternName: 'Bearish Engulfing (Nhấn Chìm Giảm)',
        signalType: 'SELL',
        baseConf: 71,
        reason: `Thân nến giảm bao trùm toàn bộ nến tăng liền trước tại kháng cự ${roundVnd(winHigh)} đ, cảnh báo lực chốt lời áp đảo.`,
      };
    }
    // 7. Piercing Line (Nến Xuyên thấu)
    else if (
      p1IsBear &&
      p1Body >= p1Range * 0.4 &&
      isBull &&
      b.open <= p1.close * 1.002 &&
      b.close > (p1.open + p1.close) / 2 &&
      b.close < p1.open &&
      nearSupport
    ) {
      detected = {
        patternId: 'piercing_line',
        patternName: 'Piercing Line (Xuyên Thấu)',
        signalType: 'BUY',
        baseConf: 66,
        reason: `Giá mở cửa yếu nhưng lực cầu đẩy đóng cửa vượt 50% thân nến giảm trước (${roundVnd(b.close)} đ), xác nhận lực đỡ tại vùng đáy.`,
      };
    }
    // 8. Dark Cloud Cover (Mây đen che phủ)
    else if (
      p1IsBull &&
      p1Body >= p1Range * 0.4 &&
      isBear &&
      b.open >= p1.close * 0.998 &&
      b.close < (p1.open + p1.close) / 2 &&
      b.close > p1.open &&
      nearResistance
    ) {
      detected = {
        patternId: 'dark_cloud_cover',
        patternName: 'Dark Cloud Cover (Mây Đen Che Phủ)',
        signalType: 'SELL',
        baseConf: 66,
        reason: `Sau phiên tăng, áp lực bán ép giá đóng cửa xuyên thủng 50% thân nến tăng trước tại vùng đỉnh ${roundVnd(winHigh)} đ.`,
      };
    }
    // 9. Dragonfly Doji / Hammer at Support
    else if (
      nearSupport &&
      lowerWick >= Math.max(body * 2.0, range * 0.5) &&
      upperWick <= range * 0.2
    ) {
      const isDoji = body <= range * 0.14;
      detected = {
        patternId: isDoji ? 'dragonfly_doji' : 'hammer',
        patternName: isDoji
          ? 'Dragonfly Doji (Chuồn Chuồn)'
          : 'Hammer (Nến Búa Rút Chân)',
        signalType: 'BUY',
        baseConf: isDoji ? 67 : 68,
        reason: `Bóng nến dưới dài (${roundVnd(b.low)} đ) phản ánh lực cầu bắt đáy mạnh mẽ ngay tại vùng hỗ trợ ${roundVnd(winLow)} đ.`,
      };
    }
    // 10. Gravestone Doji / Shooting Star at Resistance
    else if (
      nearResistance &&
      upperWick >= Math.max(body * 2.0, range * 0.5) &&
      lowerWick <= range * 0.2
    ) {
      const isDoji = body <= range * 0.14;
      detected = {
        patternId: isDoji ? 'gravestone_doji' : 'shooting_star',
        patternName: isDoji
          ? 'Gravestone Doji (Bia Mộ)'
          : 'Shooting Star (Sao Băng)',
        signalType: 'SELL',
        baseConf: isDoji ? 67 : 68,
        reason: `Bóng nến trên kéo dài lên ${roundVnd(b.high)} đ nhưng bị ép đóng cửa thấp, cảnh báo lực cung xả hàng tại kháng cự.`,
      };
    }

    if (!detected) continue;

    // Confidence scoring (0-100%) via MA20/Bollinger confluence + volume spike + news alignment
    let conf = detected.baseConf;
    const confluenceNotes: string[] = [];

    if (detected.signalType === 'BUY') {
      if (b.ma20 && Math.abs(b.low - b.ma20) / b.ma20 <= 0.022) {
        conf += 7;
        confluenceNotes.push('Hội tụ hỗ trợ MA20');
      }
      if (b.bbLower && b.low <= b.bbLower * 1.015) {
        conf += 6;
        confluenceNotes.push('Chạm biên dưới Bollinger');
      }
      if (b.rsi14 !== null && b.rsi14 !== undefined && b.rsi14 <= 42) {
        conf += 5;
        confluenceNotes.push(`RSI quá bán (${b.rsi14})`);
      }
      if (volRatio >= 1.35) {
        conf += 7;
        confluenceNotes.push(`KL xác nhận ${volRatio.toFixed(1)}x TB20`);
      }
      if (bullNewsCount > bearNewsCount) {
        conf += 5;
        confluenceNotes.push('Đồng thuận tin tức tích cực');
      } else if (bearNewsCount > bullNewsCount) {
        conf -= 6;
      }
    } else {
      if (b.bbUpper && b.high >= b.bbUpper * 0.985) {
        conf += 6;
        confluenceNotes.push('Chạm biên trên Bollinger');
      }
      if (b.rsi14 !== null && b.rsi14 !== undefined && b.rsi14 >= 66) {
        conf += 6;
        confluenceNotes.push(`RSI quá mua (${b.rsi14})`);
      }
      if (volRatio >= 1.4) {
        conf += 7;
        confluenceNotes.push(`KL xả ${volRatio.toFixed(1)}x TB20`);
      }
      if (bearNewsCount > bullNewsCount) {
        conf += 5;
        confluenceNotes.push('Cộng hưởng tin rủi ro');
      }
    }

    const clampedConf = Math.max(42, Math.min(96, Math.round(conf)));

    signals.push({
      id: `candle-${detected.patternId}-${b.date}`,
      date: b.date,
      patternId: detected.patternId,
      patternName: detected.patternName,
      signalType: detected.signalType,
      price: b.close,
      confidencePct: clampedConf,
      confluenceNotes,
      reason: detected.reason,
    });
  }

  return signals.slice(-10).reverse();
}

export function computeCandlestickTradeSetup(
  bars: OhlcBar[],
  candleSignals: CandlestickSignalItem[],
  indicators: TechnicalIndicatorsSnapshot,
  riskReward: RiskRewardSummary,
  recentNews: Array<{ title: string; impactLabel: FinanceArticleImpactLabel }> = []
): TradeSetupPlan {
  const lastBar = bars[bars.length - 1];
  const lastClose = lastBar?.close || 10000;
  const roundPrice = (v: number) => Math.max(100, Math.round(v / 50) * 50);

  const latest = candleSignals[0];
  const latestBull = candleSignals.find((s) => s.signalType === 'BUY');
  const headlineNote = recentNews[0]
    ? ` Kết hợp tin tức gần nhất (${recentNews[0].impactLabel}): "${recentNews[0].title.slice(0, 95)}".`
    : ' Chưa có tin tức doanh nghiệp đột biến đối nghịch xu hướng giá.';

  if (!latest) {
    const entryLow = roundPrice((indicators.ma20 || lastClose) * 0.99);
    const entryHigh = roundPrice(lastClose * 1.005);
    return {
      activePatternName: 'Tích lũy cân bằng (Chờ nến xác nhận)',
      signalType: 'NEUTRAL',
      confidencePct: 52,
      status: lastClose <= entryHigh && lastClose >= entryLow * 0.985 ? 'ĐANG TRONG VÙNG MUA' : 'ĐANG TRONG VÙNG MUA',
      entryZoneLow: Math.min(entryLow, entryHigh),
      entryZoneHigh: Math.max(entryLow, entryHigh),
      tp1Price: riskReward.tp1Price,
      tp1Pct: riskReward.tp1Pct,
      tp2Price: riskReward.tp2Price,
      tp2Pct: riskReward.tp2Pct,
      slPrice: riskReward.slPrice,
      slPct: riskReward.slPct,
      riskRewardRatio: riskReward.riskRewardRatio,
      explanation: `Đồ thị chưa hình thành mẫu hình nến đảo chiều cực đoan ở phiên gần nhất; ưu tiên quan sát vùng kiểm định MA20 (${(indicators.ma20 || lastClose).toLocaleString('vi-VN')} đ).${headlineNote}`,
    };
  }

  const sigIdx = bars.findIndex((b) => b.date === latest.date);
  const sigBar = sigIdx >= 0 ? bars[sigIdx] : lastBar;

  if (latest.signalType === 'BUY') {
    const bodyMid = sigBar ? (sigBar.open + sigBar.close) / 2 : lastClose * 0.995;
    const entryZoneLow = roundPrice(Math.min(bodyMid, sigBar?.close || lastClose) * 0.995);
    const entryZoneHigh = roundPrice(Math.max(sigBar?.close || lastClose, lastClose * 1.004));
    const slRaw = (sigBar?.low || lastClose * 0.96) * 0.99;
    const slPrice = roundPrice(Math.min(entryZoneLow * 0.985, Math.max(lastClose * 0.88, slRaw)));

    const riskUnit = Math.max(100, entryZoneHigh - slPrice);
    const tp1Price = roundPrice(
      Math.max(entryZoneHigh + riskUnit * 1.5, indicators.resistance > entryZoneHigh * 1.02 ? indicators.resistance : entryZoneHigh * 1.05)
    );
    const tp2Price = roundPrice(
      Math.max(tp1Price + riskUnit * 0.9, entryZoneHigh + riskUnit * 2.5)
    );

    const tp1Pct = Number((((tp1Price - lastClose) / Math.max(1, lastClose)) * 100).toFixed(2));
    const tp2Pct = Number((((tp2Price - lastClose) / Math.max(1, lastClose)) * 100).toFixed(2));
    const slPct = Number((((slPrice - lastClose) / Math.max(1, lastClose)) * 100).toFixed(2));
    const rr = Number((Math.max(100, tp1Price - lastClose) / Math.max(100, lastClose - slPrice)).toFixed(2));

    let status: TradeSetupStatus = 'ĐANG TRONG VÙNG MUA';
    if (lastClose <= slPrice) status = 'VI PHẠM CẮT LỖ';
    else if (lastClose >= tp1Price) status = 'ĐÃ CHẠM TP1';

    return {
      activePatternName: latest.patternName,
      signalType: 'BUY',
      confidencePct: latest.confidencePct,
      status,
      entryZoneLow: Math.min(entryZoneLow, entryZoneHigh),
      entryZoneHigh: Math.max(entryZoneLow, entryZoneHigh),
      tp1Price,
      tp1Pct,
      tp2Price,
      tp2Pct,
      slPrice,
      slPct,
      riskRewardRatio: rr,
      explanation: `Mô hình ${latest.patternName} xuất hiện ngày ${latest.date} với độ tin cậy ${latest.confidencePct}%${latest.confluenceNotes.length > 0 ? ` (${latest.confluenceNotes.join(', ')})` : ''}. Vùng giải ngân tối ưu quanh 50% thân nến đến giá xác nhận, chặn lỗ dưới đáy nến -1%.${headlineNote}`,
    };
  }

  // SELL / Take Profit signal
  const refEntryLow = roundPrice(
    Math.max(indicators.support || lastClose * 0.94, (indicators.ma20 || lastClose) * 0.97)
  );
  const refEntryHigh = roundPrice(refEntryLow * 1.018);
  const refSl = roundPrice(refEntryLow * 0.95);
  const tp1Price = roundPrice(Math.max(lastClose, indicators.resistance || lastClose * 1.02));
  const tp2Price = roundPrice(tp1Price * 1.045);

  const bullNote = latestBull
    ? ` (Trước đó có điểm mua ${latestBull.patternName} ngày ${latestBull.date}).`
    : '';

  return {
    activePatternName: latest.patternName,
    signalType: 'SELL',
    confidencePct: latest.confidencePct,
    status: 'TÍN HIỆU THOÁT LỆNH',
    entryZoneLow: refEntryLow,
    entryZoneHigh: refEntryHigh,
    tp1Price,
    tp1Pct: Number((((tp1Price - lastClose) / Math.max(1, lastClose)) * 100).toFixed(2)),
    tp2Price,
    tp2Pct: Number((((tp2Price - lastClose) / Math.max(1, lastClose)) * 100).toFixed(2)),
    slPrice: refSl,
    slPct: Number((((refSl - lastClose) / Math.max(1, lastClose)) * 100).toFixed(2)),
    riskRewardRatio: riskReward.riskRewardRatio,
    explanation: `Cảnh báo chốt lời/thoát lệnh từ mô hình ${latest.patternName} ngày ${latest.date} (tin cậy ${latest.confidencePct}%)${bullNote} Nên canh hồi kỹ thuật quanh vùng kháng cự để hạ tỷ trọng hoặc chờ chiết khấu về vùng hỗ trợ.${headlineNote}`,
  };
}

export function detectStockAnomalies(params: {
  symbol: string;
  companyName: string;
  exchange: MarketExchange;
  quote: StockQuoteSnapshot;
  bars: OhlcBar[];
  indicators: TechnicalIndicatorsSnapshot;
  relatedNews?: Array<{ title: string; summary?: string }>;
}): CashflowAnomalyItem[] {
  const { symbol, companyName, exchange, quote, bars, indicators, relatedNews = [] } = params;
  const anomalies: CashflowAnomalyItem[] = [];
  const nowIso = new Date().toISOString();

  const lastBar = bars[bars.length - 1];
  const volAvg20 = indicators.volMa20 || (bars.length > 0 ? bars.reduce((a, b) => a + b.volume, 0) / bars.length : 0);
  const currentVol = quote.volume > 0 ? quote.volume : lastBar?.volume || 0;
  const volRatio20 = volAvg20 > 0 ? Number((currentVol / volAvg20).toFixed(2)) : 1;

  // 1. Volume / Price Anomaly (>= 2.0x MA20_Vol)
  if (volRatio20 >= 2.0) {
    const isBullBar = lastBar ? lastBar.close >= lastBar.open : true;
    const isAccumulation = quote.changePct >= 0 && isBullBar;
    anomalies.push({
      id: `anom-vol-${symbol}-${nowIso.slice(0, 10)}`,
      symbol,
      companyName,
      exchange,
      direction: isAccumulation ? 'accumulation' : 'distribution',
      title: isAccumulation
        ? `${symbol}: Gom hàng bất thường (${volRatio20}x TB20)`
        : `${symbol}: Phân phối / Xả hàng (${volRatio20}x TB20)`,
      detail: isAccumulation
        ? `Khối lượng khớp ${currentVol.toLocaleString('vi-VN')} cp (vượt ${Math.round(volRatio20 * 100)}% TB 20 phiên) đẩy giá tăng ${quote.changePct >= 0 ? '+' : ''}${quote.changePct}%.`
        : `Thanh khoản bùng nổ ${currentVol.toLocaleString('vi-VN')} cp (${volRatio20}x TB20) kèm áp lực ép giá ${quote.changePct}% — cảnh báo phân phối.`,
      price: quote.price,
      changePct: quote.changePct,
      volumeRatio20: volRatio20,
      foreignNetVol: quote.foreignNetVol,
      severity: isAccumulation ? 'opportunity' : 'critical',
      detectedAt: nowIso,
    });
  }

  // 2. Foreign / Institutional Net Flow Anomaly (>= 2.5x 10-session baseline proxy or >3.0x block liquidity)
  const foreignBaselineProxy = Math.max(80_000, Math.round((volAvg20 || 300_000) * 0.08));
  if (Math.abs(quote.foreignNetVol) >= foreignBaselineProxy * 2.5) {
    const fBuy = quote.foreignNetVol > 0;
    anomalies.push({
      id: `anom-for-${symbol}-${nowIso.slice(0, 10)}`,
      symbol,
      companyName,
      exchange,
      direction: 'foreign_spike',
      title: `${symbol}: Đột biến Khối ngoại ${fBuy ? 'mua ròng' : 'bán ròng'} ${Math.abs(quote.foreignNetVol).toLocaleString('vi-VN')} cp`,
      detail: `Giá trị giao dịch ròng ngoại vượt ≥2.5x mức nền thanh khoản tổ chức gần đây (Giá ${quote.price.toLocaleString('vi-VN')} đ, ${quote.changePct >= 0 ? '+' : ''}${quote.changePct}%).`,
      price: quote.price,
      changePct: quote.changePct,
      volumeRatio20: volRatio20,
      foreignNetVol: quote.foreignNetVol,
      severity: fBuy ? 'opportunity' : 'critical',
      detectedAt: nowIso,
    });
  } else if (volRatio20 >= 3.0 && Math.abs(quote.changePct) <= 1.2) {
    anomalies.push({
      id: `anom-blk-${symbol}-${nowIso.slice(0, 10)}`,
      symbol,
      companyName,
      exchange,
      direction: 'foreign_spike',
      title: `${symbol}: Nghi vấn sang tay / thỏa thuận lớn (${volRatio20}x TB20)`,
      detail: `Khối lượng đột biến ${currentVol.toLocaleString('vi-VN')} cp nhưng biên độ giá hẹp (${quote.changePct}%), dấu hiệu hấp thụ lệnh lô lớn.`,
      price: quote.price,
      changePct: quote.changePct,
      volumeRatio20: volRatio20,
      foreignNetVol: quote.foreignNetVol,
      severity: 'warning',
      detectedAt: nowIso,
    });
  }

  // 3. Intrinsic Cashflow Mismatch (CFO/FCF vs Accounting Profit from Kho Tin)
  const cfoFlag = relatedNews.find((n) =>
    CFO_MISMATCH_PATTERNS.some((re) => re.test(`${n.title} ${n.summary || ''}`))
  );
  if (cfoFlag) {
    anomalies.push({
      id: `anom-cfo-${symbol}-${nowIso.slice(0, 10)}`,
      symbol,
      companyName,
      exchange,
      direction: 'cfo_divergence',
      title: `${symbol}: Cảnh báo lệch pha Dòng tiền nội tại (CFO/LN)`,
      detail: `Tin/BCTC phát hiện dấu hiệu lệch pha lợi nhuận kế toán & dòng tiền kinh doanh: "${cfoFlag.title.slice(0, 140)}".`,
      price: quote.price,
      changePct: quote.changePct,
      volumeRatio20: volRatio20,
      foreignNetVol: quote.foreignNetVol,
      severity: 'warning',
      detectedAt: nowIso,
    });
  }

  return anomalies;
}

function resolveBarIndexForRelativeTime(publishedRelative: string, totalBars: number): number {
  if (totalBars <= 1) return 0;
  const lower = publishedRelative.toLowerCase();
  if (lower.includes('phút') || lower.includes('giờ') || lower.includes('hôm nay') || lower.includes('mới')) {
    return totalBars - 1;
  }
  const dayMatch = lower.match(/(\d+)\s*ngày/);
  if (dayMatch) {
    const offset = Math.min(totalBars - 1, Math.max(0, Number(dayMatch[1]) || 0));
    return Math.max(0, totalBars - 1 - offset);
  }
  return totalBars - 1;
}

export async function getMultiTimeframeChartTechnical(params: {
  symbol: string;
  timeframe: ChartTimeframe;
  recentNews?: Array<{
    title: string;
    summary?: string;
    impactLabel: FinanceArticleImpactLabel;
    publishedRelative: string;
  }>;
  corporateEvents?: CorporateEventItem[];
}): Promise<StockChartTechnicalResponse> {
  const symbol = params.symbol.trim().toUpperCase();
  const [quoteRes, ohlcRes] = await Promise.all([
    getStockQuote(symbol),
    getDailyOhlcHistory(symbol, 120, params.timeframe),
  ]);

  const bars = ohlcRes.ohlc.map((b) => ({ ...b }));
  const newsList = (params.recentNews || []).slice(0, 8);
  for (let idx = 0; idx < newsList.length && bars.length > 0; idx += 1) {
    const news = newsList[idx];
    let targetIdx = resolveBarIndexForRelativeTime(news.publishedRelative, bars.length);
    if (bars[targetIdx].newsMarkerTitles && targetIdx > 0) {
      targetIdx = Math.max(0, targetIdx - (idx % 3));
    }
    const bar = bars[targetIdx];
    bar.newsMarkerTitles = [...(bar.newsMarkerTitles || []), news.title];
    if (
      !bar.newsMarkerImpact ||
      news.impactLabel === 'Rủi ro cao' ||
      (bar.newsMarkerImpact === 'Trung lập' && news.impactLabel === 'Hỗ trợ tăng')
    ) {
      bar.newsMarkerImpact = news.impactLabel;
    }
  }

  // Attach Corporate Events (ĐHĐCĐ / Nội bộ) markers onto timeline
  const corpEvents = (params.corporateEvents || [])
    .filter((ev) => !ev.symbol || ev.symbol === symbol)
    .slice(0, 6);
  for (let idx = 0; idx < corpEvents.length && bars.length > 0; idx += 1) {
    const ev = corpEvents[idx];
    let targetIdx = bars.findIndex((b) => b.date === ev.eventDate);
    if (targetIdx < 0) {
      targetIdx = resolveBarIndexForRelativeTime(ev.publishedRelative, bars.length);
    }
    if (bars[targetIdx].corpEventTitle && targetIdx > 0) {
      targetIdx = Math.max(0, targetIdx - ((idx + 1) % 4));
    }
    bars[targetIdx].corpEventTitle = ev.title;
    bars[targetIdx].corpEventCategory = ev.category;
  }

  // Run 10+ Japanese Candlestick Pattern detector (0 LLM tokens)
  const candlestickSignals = detectCandlestickSignals(bars, newsList);
  const sigByDate = new Map(candlestickSignals.map((s) => [s.date, s]));
  for (const bar of bars) {
    const sig = sigByDate.get(bar.date);
    if (sig) {
      bar.candleSignalType = sig.signalType;
      bar.candlePatternName = sig.patternName;
      bar.candleConfidencePct = sig.confidencePct;
      bar.candleReason = sig.reason;
    }
  }

  const tradeSetup = computeCandlestickTradeSetup(
    bars,
    candlestickSignals,
    ohlcRes.indicators,
    ohlcRes.riskReward,
    newsList
  );

  const lastBar = bars[bars.length - 1];
  const prevBar = bars[bars.length - 2];
  const quote: StockQuoteSnapshot = quoteRes || {
    symbol,
    exchange: 'HOSE',
    companyName: symbol,
    price: lastBar?.close || 0,
    refPrice: prevBar?.close || lastBar?.close || 0,
    ceilingPrice: Math.round((prevBar?.close || 0) * 1.07),
    floorPrice: Math.round((prevBar?.close || 0) * 0.93),
    change: lastBar && prevBar ? Math.round(lastBar.close - prevBar.close) : 0,
    changePct:
      lastBar && prevBar && prevBar.close > 0
        ? Number((((lastBar.close - prevBar.close) / prevBar.close) * 100).toFixed(2))
        : 0,
    volume: lastBar?.volume || 0,
    valueVnd: (lastBar?.close || 0) * (lastBar?.volume || 0),
    foreignBuyVol: 0,
    foreignSellVol: 0,
    foreignNetVol: 0,
    tradingDate: lastBar?.date || new Date().toISOString().split('T')[0],
    sourceMode: ohlcRes.sourceMode,
  };

  const anomalies = detectStockAnomalies({
    symbol,
    companyName: quote.companyName,
    exchange: quote.exchange,
    quote,
    bars,
    indicators: ohlcRes.indicators,
    relatedNews: newsList,
  });

  return {
    generatedAt: new Date().toISOString(),
    symbol,
    timeframe: params.timeframe,
    marketDataMode: quote.sourceMode === 'ssi' || ohlcRes.sourceMode === 'ssi' ? 'ssi' : 'fallback',
    quote,
    ohlc: bars,
    indicators: ohlcRes.indicators,
    reversalSignals: ohlcRes.reversalSignals,
    riskReward: ohlcRes.riskReward,
    candlestickSignals,
    tradeSetup,
    anomalies,
  };
}

/* --- Mathematical Intraday Erratic Movers Detector (0 LLM tokens) --- */

export function analyzeSingleStockErraticMovement(params: {
  symbol: string;
  quote: StockQuoteSnapshot;
  dailyBars: OhlcBar[];
  intradayBars: OhlcBar[];
  vnIndexChangePct: number;
  minLiquidityVnd?: number;
}): IntradayErraticMover | null {
  const {
    symbol,
    quote,
    dailyBars,
    intradayBars,
    vnIndexChangePct,
    minLiquidityVnd = 10_000_000_000,
  } = params;

  const lastDaily = dailyBars[dailyBars.length - 1];
  const prevDaily = dailyBars[dailyBars.length - 2];
  const refPrice =
    quote.refPrice > 0
      ? quote.refPrice
      : prevDaily?.close && prevDaily.close > 0
        ? prevDaily.close
        : quote.price;
  const currentPrice = quote.price > 0 ? quote.price : lastDaily?.close || 0;
  if (currentPrice <= 0 || refPrice <= 0) return null;

  const effectiveVol = quote.volume > 0 ? quote.volume : lastDaily?.volume || 0;
  const effectiveValueVnd = Math.max(quote.valueVnd || 0, currentPrice * effectiveVol);
  if (effectiveValueVnd < minLiquidityVnd) {
    return null;
  }

  // Isolate latest trading day's 15m intraday candles
  let sessionBars: OhlcBar[] = [];
  if (intradayBars.length > 0) {
    const lastDateToken = intradayBars[intradayBars.length - 1].date.split(' ')[0];
    sessionBars = intradayBars.filter((b) => b.date.split(' ')[0] === lastDateToken);
    if (sessionBars.length < 3) {
      sessionBars = intradayBars.slice(-18);
    }
  }

  let openPrice = lastDaily?.open && lastDaily.open > 0 ? lastDaily.open : refPrice;
  let dayHigh = Math.max(lastDaily?.high || currentPrice, currentPrice);
  let dayLow = Math.min(lastDaily?.low || currentPrice, currentPrice);
  let signFlips = 0;
  let volumeRatio15m = 1;
  let earlyMinPct = 0;
  let earlyMaxPct = 0;
  const intradayPath: IntradaySessionPoint[] = [];

  if (sessionBars.length >= 3) {
    openPrice = sessionBars[0].open > 0 ? sessionBars[0].open : openPrice;
    dayHigh = Math.max(...sessionBars.map((b) => b.high), currentPrice);
    dayLow = Math.min(...sessionBars.map((b) => b.low), currentPrice);

    let prevSign = 0;
    let totalSessionVol = 0;
    let maxBarVol = 0;
    const halfIdx = Math.max(1, Math.floor(sessionBars.length / 2));

    sessionBars.forEach((b, idx) => {
      const pct = Number((((b.close - refPrice) / refPrice) * 100).toFixed(2));
      const sign = b.close > refPrice * 1.001 ? 1 : b.close < refPrice * 0.999 ? -1 : 0;
      if (sign !== 0 && prevSign !== 0 && sign !== prevSign) {
        signFlips += 1;
      }
      if (sign !== 0) prevSign = sign;

      totalSessionVol += b.volume || 0;
      if ((b.volume || 0) > maxBarVol) maxBarVol = b.volume || 0;

      if (idx < halfIdx) {
        const lowPct = ((b.low - refPrice) / refPrice) * 100;
        const highPct = ((b.high - refPrice) / refPrice) * 100;
        if (lowPct < earlyMinPct) earlyMinPct = lowPct;
        if (highPct > earlyMaxPct) earlyMaxPct = highPct;
      }

      const timePart = b.date.includes(' ') ? b.date.split(' ')[1] : b.date;
      intradayPath.push({
        time: timePart,
        price: b.close,
        volume: b.volume,
        changePctFromRef: pct,
      });
    });

    const avg15Vol = totalSessionVol / Math.max(1, sessionBars.length);
    volumeRatio15m = avg15Vol > 0 ? Number((maxBarVol / avg15Vol).toFixed(2)) : 1;
  } else {
    // Daily OHLC fallback path when 15m feed is unavailable (e.g. UPCOM/HNX)
    const openPct = Number((((openPrice - refPrice) / refPrice) * 100).toFixed(2));
    const lowPct = Number((((dayLow - refPrice) / refPrice) * 100).toFixed(2));
    const highPct = Number((((dayHigh - refPrice) / refPrice) * 100).toFixed(2));
    const closePct = Number((((currentPrice - refPrice) / refPrice) * 100).toFixed(2));
    earlyMinPct = Math.min(openPct, lowPct);
    earlyMaxPct = Math.max(openPct, highPct);
    if ((openPct > 0.3 && closePct < -0.3) || (openPct < -0.3 && closePct > 0.3)) {
      signFlips = 1;
    }
    const avgDailyVol =
      dailyBars.length > 0
        ? dailyBars.slice(-20).reduce((acc, b) => acc + (b.volume || 0), 0) /
          Math.min(20, dailyBars.length)
        : effectiveVol;
    volumeRatio15m = avgDailyVol > 0 ? Number((effectiveVol / avgDailyVol).toFixed(2)) : 1;

    const bullClose = currentPrice >= openPrice;
    intradayPath.push(
      { time: 'Mở cửa', price: openPrice, volume: Math.round(effectiveVol * 0.2), changePctFromRef: openPct },
      bullClose
        ? { time: 'Đáy phiên', price: dayLow, volume: Math.round(effectiveVol * 0.25), changePctFromRef: lowPct }
        : { time: 'Đỉnh phiên', price: dayHigh, volume: Math.round(effectiveVol * 0.25), changePctFromRef: highPct },
      bullClose
        ? { time: 'Đỉnh phiên', price: dayHigh, volume: Math.round(effectiveVol * 0.3), changePctFromRef: highPct }
        : { time: 'Đáy phiên', price: dayLow, volume: Math.round(effectiveVol * 0.3), changePctFromRef: lowPct },
      { time: 'Hiện tại', price: currentPrice, volume: Math.round(effectiveVol * 0.25), changePctFromRef: closePct }
    );
  }

  // ATR(14) in %
  let atrSum = 0;
  let atrCount = 0;
  for (let i = Math.max(1, dailyBars.length - 14); i < dailyBars.length; i += 1) {
    const cur = dailyBars[i];
    const prev = dailyBars[i - 1];
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close)
    );
    atrSum += tr;
    atrCount += 1;
  }
  const atr14Vnd = atrCount > 0 ? atrSum / atrCount : currentPrice * 0.024;
  const atr14Pct = Number(Math.max(0.8, (atr14Vnd / refPrice) * 100).toFixed(2));

  const change = currentPrice - refPrice;
  const changePct = Number(((change / refPrice) * 100).toFixed(2));
  const intradayAmplitudePct = Number((((dayHigh - dayLow) / refPrice) * 100).toFixed(2));
  const amplitudeVsAtrRatio = Number((intradayAmplitudePct / Math.max(0.8, atr14Pct)).toFixed(2));
  const pricePositionInRangePct =
    dayHigh > dayLow
      ? Math.max(0, Math.min(100, Math.round(((currentPrice - dayLow) / (dayHigh - dayLow)) * 100)))
      : 50;
  const gapPct = Number((((openPrice - refPrice) / refPrice) * 100).toFixed(2));
  const betaDeviationPct = Number((changePct - vnIndexChangePct).toFixed(2));

  const isWideAmplitude = intradayAmplitudePct >= 4.2 || amplitudeVsAtrRatio >= 1.75;
  const isVShape =
    isWideAmplitude &&
    (earlyMinPct <= -1.2 || ((dayLow - refPrice) / refPrice) * 100 <= -2.0) &&
    pricePositionInRangePct >= 66 &&
    (changePct >= 0.4 || currentPrice >= openPrice * 1.015);
  const isInvertedV =
    isWideAmplitude &&
    (earlyMaxPct >= 1.2 || ((dayHigh - refPrice) / refPrice) * 100 >= 2.0) &&
    pricePositionInRangePct <= 34 &&
    (changePct <= -0.3 || currentPrice <= openPrice * 0.985);
  const isWhipsaw = signFlips >= 2 && (volumeRatio15m >= 2.2 || intradayAmplitudePct >= 2.6);
  const isCeilingOrFloor =
    currentPrice >= quote.ceilingPrice * 0.995 || currentPrice <= quote.floorPrice * 1.005;
  const isGapOrBetaAnomaly =
    Math.abs(gapPct) >= 3.0 ||
    isCeilingOrFloor ||
    (Math.abs(betaDeviationPct) >= 3.5 && Math.abs(changePct) >= 2.8);

  let patternType: ErraticPatternType;
  let patternLabel: ErraticPatternDisplayLabel;

  if (isVShape) {
    patternType = 'v_shape_reversal';
    patternLabel = 'Rút chân đảo chiều mạnh';
  } else if (isInvertedV) {
    patternType = 'inverted_v_pullback';
    patternLabel = 'Kéo xả cuối phiên';
  } else if (isWhipsaw) {
    patternType = 'whipsaw_stophunt';
    patternLabel = 'Giật lắc 2 đầu';
  } else if (isGapOrBetaAnomaly) {
    patternType = 'gap_liquidity_vacuum';
    patternLabel = 'Tăng trần/Giảm sàn đột biến';
  } else if (pricePositionInRangePct >= 68 && intradayAmplitudePct >= 2.3) {
    patternType = 'v_shape_reversal';
    patternLabel = 'Rút chân đảo chiều mạnh';
  } else if (pricePositionInRangePct <= 32 && intradayAmplitudePct >= 2.3) {
    patternType = 'inverted_v_pullback';
    patternLabel = 'Kéo xả cuối phiên';
  } else if (signFlips >= 1 && volumeRatio15m >= 1.8) {
    patternType = 'whipsaw_stophunt';
    patternLabel = 'Giật lắc 2 đầu';
  } else {
    patternType = 'gap_liquidity_vacuum';
    patternLabel = 'Tăng trần/Giảm sàn đột biến';
  }

  const ampPts = Math.min(34, intradayAmplitudePct * 5.0);
  const atrPts = Math.min(20, amplitudeVsAtrRatio * 8.5);
  const whipPts = Math.min(
    22,
    signFlips * 6.5 + (volumeRatio15m >= 3.0 ? 9 : volumeRatio15m >= 2.2 ? 5 : volumeRatio15m * 1.5)
  );
  const betaGapPts = Math.min(
    24,
    Math.abs(betaDeviationPct) * 3.4 + (Math.abs(gapPct) >= 3.0 ? 7 : 0) + (isCeilingOrFloor ? 6 : 0)
  );
  const erraticScore = Math.max(10, Math.min(99, Math.round(ampPts + atrPts + whipPts + betaGapPts)));

  const signalsTriggered: string[] = [];
  if (intradayAmplitudePct >= 2.0) {
    signalsTriggered.push(`Biên độ ${intradayAmplitudePct}% (${amplitudeVsAtrRatio}x ATR14)`);
  }
  if (signFlips >= 2) {
    signalsTriggered.push(`Đổi chiều Xanh↔Đỏ ${signFlips} lần`);
  }
  if (volumeRatio15m >= 2.0) {
    signalsTriggered.push(`KL khung ngắn ${volumeRatio15m}x TB`);
  }
  if (Math.abs(gapPct) >= 2.0) {
    signalsTriggered.push(`Gap mở cửa ${gapPct > 0 ? '+' : ''}${gapPct}%`);
  }
  if (isCeilingOrFloor) {
    signalsTriggered.push(currentPrice >= quote.ceilingPrice * 0.995 ? 'Chạm giá Trần (CE)' : 'Chạm giá Sàn (FL)');
  }
  if (Math.abs(betaDeviationPct) >= 2.5) {
    signalsTriggered.push(`Lệch VN-Index ${betaDeviationPct > 0 ? '+' : ''}${betaDeviationPct}%`);
  }
  if (signalsTriggered.length === 0) {
    signalsTriggered.push(`Dao động phiên ${intradayAmplitudePct}% · Giá trị ${(effectiveValueVnd / 1e9).toFixed(0)} tỷ`);
  }

  return {
    symbol,
    exchange: quote.exchange,
    companyName: quote.companyName,
    price: Math.round(currentPrice),
    refPrice: Math.round(refPrice),
    openPrice: Math.round(openPrice),
    dayHigh: Math.round(dayHigh),
    dayLow: Math.round(dayLow),
    change: Math.round(change),
    changePct,
    intradayAmplitudePct,
    pricePositionInRangePct,
    atr14Pct,
    amplitudeVsAtrRatio,
    volume: Math.round(effectiveVol),
    valueVnd: Math.round(effectiveValueVnd),
    volumeRatio15m,
    foreignNetVol: quote.foreignNetVol,
    vnIndexChangePct: Number(vnIndexChangePct.toFixed(2)),
    betaDeviationPct,
    patternType,
    patternLabel,
    erraticScore,
    signalsTriggered: signalsTriggered.slice(0, 4),
    intradayPath: intradayPath.slice(-24),
    sourceMode: quote.sourceMode,
  };
}

/* --- 4-Pillar Watchlist Fundamental, Liquidity, Timing & Recommendation Engine (0 LLM Tokens) --- */

interface SectorBenchmarkInfo {
  label: string;
  avgPe: number;
  avgPb: number;
  defaultRoe: number;
}

const VN_SECTOR_BENCHMARKS: Record<StockSectorGroup, SectorBenchmarkInfo> = {
  BANK: { label: 'Ngân hàng', avgPe: 9.2, avgPb: 1.55, defaultRoe: 18.5 },
  SECURITIES: { label: 'Chứng khoán', avgPe: 16.8, avgPb: 1.85, defaultRoe: 14.5 },
  STEEL: { label: 'Thép & Vật liệu', avgPe: 15.2, avgPb: 1.5, defaultRoe: 12.8 },
  TECH_RETAIL: { label: 'Công nghệ & Bán lẻ', avgPe: 21.5, avgPb: 3.4, defaultRoe: 21.0 },
  REAL_ESTATE: { label: 'Bất động sản & KCN', avgPe: 18.5, avgPb: 1.65, defaultRoe: 11.5 },
  OIL_GAS: { label: 'Dầu khí & Năng lượng', avgPe: 13.8, avgPb: 1.45, defaultRoe: 14.0 },
  CONSUMER: { label: 'Tiêu dùng & Thực phẩm', avgPe: 18.2, avgPb: 2.8, defaultRoe: 19.5 },
  INDUSTRIAL: { label: 'Công nghiệp & Hạ tầng', avgPe: 14.6, avgPb: 1.75, defaultRoe: 16.5 },
  OTHER: { label: 'Đa ngành', avgPe: 15.0, avgPb: 1.65, defaultRoe: 14.0 },
};

interface TickerFundamentalBaseline {
  sector: StockSectorGroup;
  roePct: number;
  eps: number; // VND
  bvps: number; // VND
  quarterLabel: string;
}

const VN_FUNDAMENTAL_BASELINES: Record<string, TickerFundamentalBaseline> = {
  // Banks
  VCB: { sector: 'BANK', roePct: 20.4, eps: 6150, bvps: 33200, quarterLabel: 'TTM' },
  TCB: { sector: 'BANK', roePct: 16.8, eps: 3150, bvps: 20400, quarterLabel: 'TTM' },
  MBB: { sector: 'BANK', roePct: 21.8, eps: 4250, bvps: 21300, quarterLabel: 'TTM' },
  ACB: { sector: 'BANK', roePct: 22.1, eps: 3780, bvps: 18600, quarterLabel: 'TTM' },
  BID: { sector: 'BANK', roePct: 18.2, eps: 4120, bvps: 24500, quarterLabel: 'TTM' },
  CTG: { sector: 'BANK', roePct: 16.5, eps: 3980, bvps: 26200, quarterLabel: 'TTM' },
  VPB: { sector: 'BANK', roePct: 11.4, eps: 1790, bvps: 17100, quarterLabel: 'TTM' },
  HDB: { sector: 'BANK', roePct: 24.3, eps: 4320, bvps: 19200, quarterLabel: 'TTM' },
  STB: { sector: 'BANK', roePct: 18.9, eps: 4720, bvps: 27400, quarterLabel: 'TTM' },
  TPB: { sector: 'BANK', roePct: 15.1, eps: 2140, bvps: 15200, quarterLabel: 'TTM' },
  VIB: { sector: 'BANK', roePct: 19.6, eps: 2680, bvps: 14900, quarterLabel: 'TTM' },
  SSB: { sector: 'BANK', roePct: 14.5, eps: 1760, bvps: 13200, quarterLabel: 'TTM' },
  SHB: { sector: 'BANK', roePct: 15.8, eps: 2050, bvps: 14100, quarterLabel: 'TTM' },
  LPB: { sector: 'BANK', roePct: 23.4, eps: 3580, bvps: 16500, quarterLabel: 'TTM' },
  OCB: { sector: 'BANK', roePct: 12.2, eps: 1450, bvps: 13100, quarterLabel: 'TTM' },
  // Securities
  SSI: { sector: 'SECURITIES', roePct: 13.8, eps: 1820, bvps: 14400, quarterLabel: 'TTM' },
  VND: { sector: 'SECURITIES', roePct: 10.6, eps: 1240, bvps: 12600, quarterLabel: 'TTM' },
  VCI: { sector: 'SECURITIES', roePct: 13.4, eps: 1980, bvps: 16100, quarterLabel: 'TTM' },
  HCM: { sector: 'SECURITIES', roePct: 12.9, eps: 1650, bvps: 13900, quarterLabel: 'TTM' },
  SHS: { sector: 'SECURITIES', roePct: 11.2, eps: 1290, bvps: 12800, quarterLabel: 'TTM' },
  MBS: { sector: 'SECURITIES', roePct: 14.9, eps: 1850, bvps: 13600, quarterLabel: 'TTM' },
  FTS: { sector: 'SECURITIES', roePct: 14.2, eps: 2210, bvps: 16900, quarterLabel: 'TTM' },
  // Steel & Materials
  HPG: { sector: 'STEEL', roePct: 11.8, eps: 1960, bvps: 17800, quarterLabel: 'TTM' },
  HSG: { sector: 'STEEL', roePct: 7.4, eps: 1150, bvps: 17600, quarterLabel: 'TTM' },
  NKG: { sector: 'STEEL', roePct: 8.1, eps: 1420, bvps: 19200, quarterLabel: 'TTM' },
  // Tech & Retail
  FPT: { sector: 'TECH_RETAIL', roePct: 27.6, eps: 5620, bvps: 22400, quarterLabel: 'TTM' },
  MWG: { sector: 'TECH_RETAIL', roePct: 14.4, eps: 2740, bvps: 19800, quarterLabel: 'TTM' },
  FRT: { sector: 'TECH_RETAIL', roePct: 18.2, eps: 3280, bvps: 18900, quarterLabel: 'TTM' },
  DGW: { sector: 'TECH_RETAIL', roePct: 16.5, eps: 2650, bvps: 17400, quarterLabel: 'TTM' },
  PNJ: { sector: 'TECH_RETAIL', roePct: 20.8, eps: 6180, bvps: 31900, quarterLabel: 'TTM' },
  CTR: { sector: 'TECH_RETAIL', roePct: 26.4, eps: 4920, bvps: 19600, quarterLabel: 'TTM' },
  VTP: { sector: 'TECH_RETAIL', roePct: 23.8, eps: 3450, bvps: 15800, quarterLabel: 'TTM' },
  // Real Estate & Industrial Parks
  VHM: { sector: 'REAL_ESTATE', roePct: 17.5, eps: 6420, bvps: 42800, quarterLabel: 'TTM' },
  VIC: { sector: 'REAL_ESTATE', roePct: 7.8, eps: 2150, bvps: 31500, quarterLabel: 'TTM' },
  VRE: { sector: 'REAL_ESTATE', roePct: 10.8, eps: 1840, bvps: 18200, quarterLabel: 'TTM' },
  KDH: { sector: 'REAL_ESTATE', roePct: 8.2, eps: 1210, bvps: 17400, quarterLabel: 'TTM' },
  NLG: { sector: 'REAL_ESTATE', roePct: 7.6, eps: 1580, bvps: 23500, quarterLabel: 'TTM' },
  KBC: { sector: 'REAL_ESTATE', roePct: 6.4, eps: 1120, bvps: 23800, quarterLabel: 'TTM' },
  IDC: { sector: 'REAL_ESTATE', roePct: 31.2, eps: 5450, bvps: 19200, quarterLabel: 'TTM' },
  BCM: { sector: 'REAL_ESTATE', roePct: 13.5, eps: 2420, bvps: 19600, quarterLabel: 'TTM' },
  NVL: { sector: 'REAL_ESTATE', roePct: -2.4, eps: -380, bvps: 18400, quarterLabel: 'TTM' },
  DIG: { sector: 'REAL_ESTATE', roePct: 3.1, eps: 390, bvps: 16200, quarterLabel: 'TTM' },
  DXG: { sector: 'REAL_ESTATE', roePct: 4.2, eps: 520, bvps: 14800, quarterLabel: 'TTM' },
  PDR: { sector: 'REAL_ESTATE', roePct: 6.1, eps: 820, bvps: 14100, quarterLabel: 'TTM' },
  CEO: { sector: 'REAL_ESTATE', roePct: 4.5, eps: 510, bvps: 12400, quarterLabel: 'TTM' },
  // Oil & Gas / Power
  GAS: { sector: 'OIL_GAS', roePct: 18.1, eps: 4980, bvps: 29400, quarterLabel: 'TTM' },
  PLX: { sector: 'OIL_GAS', roePct: 12.6, eps: 2640, bvps: 22100, quarterLabel: 'TTM' },
  PVS: { sector: 'OIL_GAS', roePct: 9.4, eps: 2280, bvps: 27400, quarterLabel: 'TTM' },
  BSR: { sector: 'OIL_GAS', roePct: 8.8, eps: 1560, bvps: 19100, quarterLabel: 'TTM' },
  POW: { sector: 'OIL_GAS', roePct: 5.4, eps: 690, bvps: 14200, quarterLabel: 'TTM' },
  // Consumer & Food
  VNM: { sector: 'CONSUMER', roePct: 26.2, eps: 4480, bvps: 17400, quarterLabel: 'TTM' },
  MSN: { sector: 'CONSUMER', roePct: 6.8, eps: 1420, bvps: 22600, quarterLabel: 'TTM' },
  SAB: { sector: 'CONSUMER', roePct: 18.4, eps: 3560, bvps: 20100, quarterLabel: 'TTM' },
  VHC: { sector: 'CONSUMER', roePct: 13.6, eps: 5120, bvps: 42100, quarterLabel: 'TTM' },
  // Industrial, Chemicals, Logistics & Telecom
  DGC: { sector: 'INDUSTRIAL', roePct: 25.4, eps: 8340, bvps: 36500, quarterLabel: 'TTM' },
  GMD: { sector: 'INDUSTRIAL', roePct: 18.7, eps: 4250, bvps: 25600, quarterLabel: 'TTM' },
  REE: { sector: 'INDUSTRIAL', roePct: 12.8, eps: 4120, bvps: 38200, quarterLabel: 'TTM' },
  GVR: { sector: 'INDUSTRIAL', roePct: 7.9, eps: 980, bvps: 13600, quarterLabel: 'TTM' },
  BVH: { sector: 'INDUSTRIAL', roePct: 9.2, eps: 2780, bvps: 31400, quarterLabel: 'TTM' },
  VJC: { sector: 'INDUSTRIAL', roePct: 9.5, eps: 2620, bvps: 31200, quarterLabel: 'TTM' },
  HVN: { sector: 'INDUSTRIAL', roePct: 14.8, eps: 1650, bvps: 8400, quarterLabel: 'TTM' },
  ACV: { sector: 'INDUSTRIAL', roePct: 19.6, eps: 4920, bvps: 27600, quarterLabel: 'TTM' },
  VEA: { sector: 'INDUSTRIAL', roePct: 24.5, eps: 4860, bvps: 20400, quarterLabel: 'TTM' },
  VGI: { sector: 'INDUSTRIAL', roePct: 14.2, eps: 1940, bvps: 14800, quarterLabel: 'TTM' },
  DPM: { sector: 'INDUSTRIAL', roePct: 8.6, eps: 2140, bvps: 28900, quarterLabel: 'TTM' },
  DCM: { sector: 'INDUSTRIAL', roePct: 13.9, eps: 2760, bvps: 20400, quarterLabel: 'TTM' },
};

const ssiDetailsCache = new Map<
  string,
  { roePct?: number; eps?: number; bvps?: number; sectorHint?: StockSectorGroup; expiresAt: number }
>();

function inferSectorGroupFromText(symbol: string, companyName: string): StockSectorGroup {
  if (VN_FUNDAMENTAL_BASELINES[symbol]) {
    return VN_FUNDAMENTAL_BASELINES[symbol].sector;
  }
  const text = `${symbol} ${companyName}`.toLowerCase();
  if (/ngân hàng|\bbank\b/.test(text)) return 'BANK';
  if (/chứng khoán|\bsecurities\b|\bsi\b/.test(text)) return 'SECURITIES';
  if (/thép|tôn|gang|vật liệu/.test(text)) return 'STEEL';
  if (/công nghệ|phần mềm|bán lẻ|viễn thông|di động|fpt|digital/.test(text)) return 'TECH_RETAIL';
  if (/bất động sản|nhà ở|đô thị|địa ốc|khu công nghiệp|vinhomes/.test(text)) return 'REAL_ESTATE';
  if (/dầu khí|xăng dầu|khí|điện|năng lượng|nhiệt điện|thủy điện/.test(text)) return 'OIL_GAS';
  if (/sữa|bia|nước giải khát|thực phẩm|thủy sản|đường|tiêu dùng/.test(text)) return 'CONSUMER';
  if (/hóa chất|cảng|vận tải|hàng không|cao su|cơ điện|phân bón|dệt may/.test(text)) return 'INDUSTRIAL';
  return 'OTHER';
}

async function fetchSsiSecuritiesDetailsCached(
  symbol: string,
  exchange: MarketExchange
): Promise<{ roePct?: number; eps?: number; bvps?: number; sectorHint?: StockSectorGroup } | null> {
  const cached = ssiDetailsCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }
  const creds = resolveSsiCredentials();
  if (creds.source === 'none') return null;

  try {
    const rows = await fetchSsiEndpoint<Record<string, unknown>>('SecuritiesDetails', {
      Market: exchange,
      Symbol: symbol,
      PageIndex: 1,
      PageSize: 5,
    });
    const first = rows[0];
    if (!first) return null;
    const rawRoe = readNum(first, ['ROE', 'Roe', 'RoeTTM'], 0);
    const rawEps = readNum(first, ['EPS', 'Eps', 'EpsTTM'], 0);
    const rawBvps = readNum(first, ['BVPS', 'Bvps', 'BookValue'], 0);
    const sectorStr = readStr(first, ['SectorName', 'IndustryName', 'GroupName']);
    const sectorHint = sectorStr ? inferSectorGroupFromText(symbol, sectorStr) : undefined;
    const entry = {
      roePct: rawRoe > 0 && rawRoe < 150 ? Number(rawRoe.toFixed(1)) : undefined,
      eps: rawEps !== 0 ? rawEps : undefined,
      bvps: rawBvps > 0 ? rawBvps : undefined,
      sectorHint,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };
    ssiDetailsCache.set(symbol, entry);
    return entry;
  } catch {
    return null;
  }
}

function extractFundamentalsFromKhoTin(
  symbol: string,
  taggedArticles: FinanceTaggedArticle[],
  storedArticles: Array<Pick<StoredNewsArticle, 'title' | 'summary'>>
): { roePct?: number; pe?: number; pb?: number } {
  const symRegex = new RegExp(`\\b${symbol}\\b`, 'i');
  const relevantTexts: string[] = [];

  for (const a of taggedArticles) {
    if (a.matchedTickers.includes(symbol) || symRegex.test(`${a.title} ${a.summary}`)) {
      relevantTexts.push(`${a.title}. ${a.summary}`);
    }
  }
  for (const s of storedArticles) {
    const text = `${s.title}. ${s.summary}`;
    if (symRegex.test(text)) {
      relevantTexts.push(text);
    }
  }

  let roePct: number | undefined;
  let pe: number | undefined;
  let pb: number | undefined;

  for (const t of relevantTexts.slice(0, 12)) {
    if (roePct === undefined) {
      const m = t.match(/\bROE\s*(?:đạt|ở mức|khoảng|:|=)?\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*%/i);
      if (m) {
        const val = Number(m[1].replace(',', '.'));
        if (val > 0 && val < 90) roePct = Number(val.toFixed(1));
      }
    }
    if (pe === undefined) {
      const m = t.match(/\bP\/E\s*(?:quanh|khoảng|đạt|:|=)?\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:lần|x)?/i);
      if (m) {
        const val = Number(m[1].replace(',', '.'));
        if (val > 1 && val < 120) pe = Number(val.toFixed(2));
      }
    }
    if (pb === undefined) {
      const m = t.match(/\bP\/B\s*(?:quanh|khoảng|đạt|:|=)?\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:lần|x)?/i);
      if (m) {
        const val = Number(m[1].replace(',', '.'));
        if (val > 0.2 && val < 25) pb = Number(val.toFixed(2));
      }
    }
  }

  return { roePct, pe, pb };
}

export async function computeWatchlistStockAnalyticsBatch(params: {
  symbols: string[];
  quotes: Record<string, StockQuoteSnapshot>;
  taggedArticles?: FinanceTaggedArticle[];
  storedArticles?: Array<Pick<StoredNewsArticle, 'title' | 'summary' | 'sentimentLabel'>>;
}): Promise<Record<string, WatchlistStockAnalytics>> {
  const uniqueSymbols = Array.from(
    new Set(
      params.symbols
        .map((s) => s.trim().toUpperCase())
        .filter((s) => /^[A-Z0-9]{1,12}$/.test(s))
    )
  ).slice(0, 20);

  if (uniqueSymbols.length === 0) return {};

  const taggedArticles = params.taggedArticles || [];
  const storedArticles = params.storedArticles || [];
  const result: Record<string, WatchlistStockAnalytics> = {};

  const BATCH_SIZE = 5;
  for (let i = 0; i < uniqueSymbols.length; i += BATCH_SIZE) {
    const batch = uniqueSymbols.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map(async (symbol) => {
        const quote = params.quotes[symbol] || (await getStockQuote(symbol));
        const [ohlcHistory, ssiDetails] = await Promise.all([
          getDailyOhlcHistory(symbol, 90, '1D').catch(() => null),
          fetchSsiSecuritiesDetailsCached(symbol, quote?.exchange || 'HOSE'),
        ]);

        const ohlc = ohlcHistory?.ohlc || [];
        const indicators =
          ohlcHistory?.indicators || enrichOhlcAndComputeIndicators([], 90).indicators;
        const latestBar = ohlc[ohlc.length - 1];
        const prevBar = ohlc[ohlc.length - 2];

        const price =
          quote && quote.price > 0 ? quote.price : latestBar?.close || 20000;
        const volume =
          quote && quote.volume > 0 ? quote.volume : latestBar?.volume || 0;
        const valueVnd =
          quote && quote.valueVnd > 0 ? quote.valueVnd : price * volume;
        const valueBillionVnd = Number((valueVnd / 1_000_000_000).toFixed(1));

        // 1. Liquidity Pillar (Vol / GTGD / % MA20 Vol)
        const ma20Vol =
          indicators.volMa20 && indicators.volMa20 > 0
            ? indicators.volMa20
            : Math.max(1, volume);
        const ma20VolPct =
          ma20Vol > 0 ? Math.round((volume / ma20Vol) * 100) : 100;
        const liqTier: WatchlistLiquidityTier =
          ma20VolPct > 130 ? 'strong' : ma20VolPct >= 70 ? 'stable' : 'low';
        const liqLabel =
          liqTier === 'strong'
            ? 'Dòng tiền nhập cuộc mạnh'
            : liqTier === 'stable'
              ? 'Thanh khoản ổn định'
              : 'Cạn cung / Thanh khoản thấp';

        // 2 & 3. Fundamentals (ROE % + Smart P/E or P/B by Sector)
        const companyName = quote?.companyName || symbol;
        const base = VN_FUNDAMENTAL_BASELINES[symbol];
        const sectorGroup: StockSectorGroup =
          base?.sector || ssiDetails?.sectorHint || inferSectorGroupFromText(symbol, companyName);
        const sectorBench = VN_SECTOR_BENCHMARKS[sectorGroup];

        const khoTinFund = extractFundamentalsFromKhoTin(
          symbol,
          taggedArticles,
          storedArticles
        );

        let roeSource: 'ssi_details' | 'kho_tin' | 'baseline' = 'baseline';
        let roePct = base?.roePct ?? sectorBench.defaultRoe;
        if (ssiDetails?.roePct !== undefined) {
          roePct = ssiDetails.roePct;
          roeSource = 'ssi_details';
        } else if (khoTinFund.roePct !== undefined) {
          roePct = khoTinFund.roePct;
          roeSource = 'kho_tin';
        }

        const roeTier: WatchlistRoeTier =
          roePct >= 18 ? 'high' : roePct >= 12 ? 'medium' : 'low';
        const roeLabel =
          roeTier === 'high'
            ? 'Hiệu quả cao'
            : roeTier === 'medium'
              ? 'Trung bình khá'
              : 'Sinh lời thấp';

        const eps = ssiDetails?.eps ?? base?.eps ?? Math.round(price / sectorBench.avgPe);
        const bvps = ssiDetails?.bvps ?? base?.bvps ?? Math.round(price / sectorBench.avgPb);

        const computedPe =
          khoTinFund.pe !== undefined
            ? khoTinFund.pe
            : eps > 0
              ? Number((price / eps).toFixed(2))
              : Number((eps < 0 ? -Math.abs(price / Math.max(100, Math.abs(eps))) : 0).toFixed(2));
        const computedPb =
          khoTinFund.pb !== undefined
            ? khoTinFund.pb
            : bvps > 0
              ? Number((price / bvps).toFixed(2))
              : 1.5;

        const isPbSector = sectorGroup === 'BANK' || sectorGroup === 'SECURITIES';
        const primaryMetric: ValuationMetricKind = isPbSector ? 'P/B' : 'P/E';
        const primaryValue = isPbSector ? computedPb : computedPe;
        const sectorAvgValue = isPbSector ? sectorBench.avgPb : sectorBench.avgPe;
        const diffVsSectorPct =
          sectorAvgValue > 0 && primaryValue > 0
            ? Number((((primaryValue - sectorAvgValue) / sectorAvgValue) * 100).toFixed(1))
            : primaryValue <= 0
              ? 35
              : 0;

        let valuationTier: WatchlistValuationTier = 'fair';
        let valuationLabel = 'Định giá hợp lý';
        if (isPbSector) {
          if (primaryValue > 0 && primaryValue < 1.3) {
            valuationTier = 'cheap';
            valuationLabel = 'Định giá hấp dẫn';
          } else if (primaryValue > 2.0 || primaryValue <= 0) {
            valuationTier = 'expensive';
            valuationLabel = 'Định giá cao';
          }
        } else {
          if (primaryValue > 0 && primaryValue < 14) {
            valuationTier = 'cheap';
            valuationLabel = 'Rẻ / Hấp dẫn';
          } else if (primaryValue > 22 || primaryValue <= 0) {
            valuationTier = 'expensive';
            valuationLabel = primaryValue <= 0 ? 'Định giá âm / Lỗ' : 'Định giá cao';
          }
        }

        // 4. Timing Pillar (MA20 / MA50 & RSI 14)
        const ma20 = indicators.ma20;
        const ma50 = indicators.ma50;
        const rsi14 = indicators.rsi14;
        const prevClose = prevBar?.close ?? price;
        const prevMa20 = prevBar?.ma20 ?? ma20;

        let maPosition: WatchlistMaPosition = 'mixed';
        let maPositionLabel = 'Tích lũy quanh MA';
        if (ma20 && ma50) {
          if (price >= ma20 && price >= ma50) {
            if (prevMa20 && prevClose <= prevMa20 && price > ma20) {
              maPosition = 'cross_up_ma20';
              maPositionLabel = 'Cắt lên MA20';
            } else {
              maPosition = 'above_both';
              maPositionLabel = 'Trên MA20 & MA50';
            }
          } else if (prevMa20 && prevClose <= prevMa20 && price > ma20) {
            maPosition = 'cross_up_ma20';
            maPositionLabel = 'Cắt lên MA20';
          } else if (price < ma20 && price < ma50) {
            maPosition = 'below_both';
            maPositionLabel = 'Dưới MA20 & MA50';
          } else {
            maPosition = 'mixed';
            maPositionLabel = price >= ma20 ? 'Trên MA20 / Dưới MA50' : 'Dưới MA20 / Trên MA50';
          }
        } else if (ma20) {
          if (prevMa20 && prevClose <= prevMa20 && price > ma20) {
            maPosition = 'cross_up_ma20';
            maPositionLabel = 'Cắt lên MA20';
          } else if (price >= ma20) {
            maPosition = 'above_both';
            maPositionLabel = 'Trên MA20';
          } else {
            maPosition = 'below_both';
            maPositionLabel = 'Dưới MA20';
          }
        }

        let rsiZoneLabel = 'Động lượng trung tính';
        if (rsi14 !== null) {
          if (rsi14 < 30) rsiZoneLabel = 'Quá bán - Vùng bắt đáy';
          else if (rsi14 < 45) rsiZoneLabel = 'Suy yếu / Chờ cân bằng';
          else if (rsi14 <= 65) rsiZoneLabel = 'Động lượng khỏe';
          else if (rsi14 <= 70) rsiZoneLabel = 'Tích cực sát quá mua';
          else rsiZoneLabel = 'Quá mua - Cẩn trọng';
        }

        // 5. 4-Pillar Investment Recommendation Engine (Weights: 35% + 30% + 20% + 15%)
        // Pillar A: Fundamental (ROE + P/E or P/B) -> max 35 pts
        let roePts = 8; // out of 17
        if (roePct >= 22) roePts = 17;
        else if (roePct >= 18) roePts = 14.5;
        else if (roePct >= 12) roePts = 10.5;
        else if (roePct >= 6) roePts = 6.5;
        else roePts = 2.5;

        let valPts = 9; // out of 18
        if (valuationTier === 'cheap') valPts = diffVsSectorPct <= -15 ? 18 : 16;
        else if (valuationTier === 'fair') valPts = diffVsSectorPct <= 0 ? 13 : 10.5;
        else valPts = primaryValue <= 0 ? 2 : 5.5;
        const fundamentalScore = Math.min(35, Math.round(roePts + valPts));

        // Pillar B: Timing (MA20/MA50 + RSI 14) -> max 30 pts
        let maPts = 8; // out of 16
        if (maPosition === 'above_both') maPts = 16;
        else if (maPosition === 'cross_up_ma20') maPts = 15;
        else if (maPosition === 'mixed') maPts = 9;
        else maPts = 3.5;

        let rsiPts = 7; // out of 14
        if (rsi14 !== null) {
          if (rsi14 >= 45 && rsi14 <= 65) rsiPts = 14;
          else if (rsi14 < 30) rsiPts = 11.5; // oversold bottom-fishing bounce potential
          else if (rsi14 >= 30 && rsi14 < 45) rsiPts = 8;
          else if (rsi14 > 65 && rsi14 <= 72) rsiPts = 9.5;
          else rsiPts = 2.5; // > 72 overbought caution
        }
        const timingScore = Math.min(30, Math.round(maPts + rsiPts));

        // Pillar C: Liquidity & Foreign Flow -> max 20 pts
        let volPts = 6; // out of 13
        if (ma20VolPct > 130) {
          volPts = (quote?.changePct ?? 0) >= -0.5 ? 13 : 6.5; // high vol selloff is penalized
        } else if (ma20VolPct >= 70) {
          volPts = 9.5;
        } else {
          volPts = 4.5;
        }
        const fNet = quote?.foreignNetVol ?? 0;
        const foreignPts = fNet > 50_000 ? 7 : fNet >= -20_000 ? 4 : 1.5;
        const liquidityScore = Math.min(20, Math.round(volPts + foreignPts));

        // Pillar D: News Sentiment & ĐHĐCĐ Catalyst (Kho Tin / DedupBot) -> max 15 pts
        let bullNews = 0;
        let bearNews = 0;
        for (const ta of taggedArticles) {
          if (ta.matchedTickers.includes(symbol)) {
            if (ta.impactLabel === 'Hỗ trợ tăng') bullNews += 1;
            else if (ta.impactLabel === 'Rủi ro cao') bearNews += 1;
          }
        }
        const symRegex = new RegExp(`\\b${symbol}\\b`, 'i');
        for (const sa of storedArticles.slice(0, 60)) {
          if (symRegex.test(`${sa.title} ${sa.summary}`)) {
            if (sa.sentimentLabel === 'Tích cực') bullNews += 0.6;
            else if (sa.sentimentLabel === 'Tiêu cực') bearNews += 0.8;
          }
        }
        const newsDelta = bullNews * 2.5 - bearNews * 3.5;
        const newsScore = Math.max(2, Math.min(15, Math.round(8.5 + newsDelta)));

        const totalScore = Math.max(
          5,
          Math.min(100, fundamentalScore + timingScore + liquidityScore + newsScore)
        );

        let verdict: WatchlistVerdictLabel = 'NẮM GIỮ / THEO DÕI';
        if (totalScore >= 80) verdict = 'MUA MẠNH / TÍCH LŨY';
        else if (totalScore >= 65) verdict = 'MUA THĂM DÒ';
        else if (totalScore < 45) verdict = 'CHỐT LỜI / HẠ TỶ TRỌNG';

        const buyLow = Math.round(((ma20 || price) * 0.985) / 100) * 100;
        const buyHigh = Math.round(((ma20 || price) * 1.01) / 100) * 100;
        const suggestedBuyZone = `${buyLow.toLocaleString('vi-VN')} – ${buyHigh.toLocaleString('vi-VN')} đ`;

        const reasons: string[] = [
          `ROE ${roePct}% (${roeLabel}) · ${primaryMetric} ${primaryValue > 0 ? primaryValue : 'Âm'} (${diffVsSectorPct >= 0 ? '+' : ''}${diffVsSectorPct}% vs TB ngành ${sectorBench.label})`,
          `${maPositionLabel} · RSI(14) = ${rsi14 ?? 'N/A'} (${rsiZoneLabel})`,
          `Thanh khoản ${ma20VolPct}% TB20 (${valueBillionVnd.toLocaleString('vi-VN')} tỷ)${fNet !== 0 ? ` · Ngoại ${fNet > 0 ? '+' : ''}${fNet.toLocaleString('vi-VN')} cp` : ''}`,
        ];

        const riskWarning =
          totalScore < 45
            ? `${valuationTier === 'expensive' ? `${primaryMetric} cao hơn TB ngành; ` : ''}${rsi14 && rsi14 > 72 ? 'RSI vùng quá mua; ' : ''}${maPosition === 'below_both' ? 'Giá nằm dưới cả MA20 & MA50' : 'Áp lực bán cần kiểm soát tỷ trọng'}`
            : undefined;

        const analytics: WatchlistStockAnalytics = {
          symbol,
          sectorGroup,
          sectorLabel: sectorBench.label,
          liquidity: {
            volume: Math.round(volume),
            valueBillionVnd,
            ma20Vol: Math.round(ma20Vol),
            ma20VolPct,
            tier: liqTier,
            label: liqLabel,
          },
          fundamentals: {
            roePct,
            roeTier,
            roeLabel,
            roeSource,
            quarterLabel: base?.quarterLabel || 'TTM',
            pe: computedPe,
            pb: computedPb,
            primaryMetric,
            primaryValue,
            sectorAvgValue,
            diffVsSectorPct,
            valuationTier,
            valuationLabel,
          },
          timing: {
            ma20,
            ma50,
            maPosition,
            maPositionLabel,
            rsi14,
            rsiZoneLabel,
          },
          recommendation: {
            totalScore,
            verdict,
            breakdown: {
              fundamentalScore,
              timingScore,
              liquidityScore,
              newsScore,
            },
            reasons,
            suggestedBuyZone,
            riskWarning,
          },
        };

        return analytics;
      })
    );

    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value) {
        result[r.value.symbol] = r.value;
      }
    }
  }

  return result;
}



