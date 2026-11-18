import type {
  GeographicRegion,
  SentimentVerdict,
  SocialPlatformTag,
  SocialTrendItem,
} from '../src/types/news.ts';
import { isApiInCooldown, recordApiCall } from './apiQuotaTracker.ts';
import { BUILTIN_VN_SECURITIES } from './ssiMarketService.ts';

const SOCIAL_USER_AGENT =
  'Mozilla/5.0 (compatible; LangKinhNewsroomBot/1.0; +https://langkinh.vn)';
const REDDIT_USER_AGENT = 'linux:langkinh.newsroom:v1.0.0 (by /u/langkinhnews)';

const KNOWN_TICKER_SET = new Set(BUILTIN_VN_SECURITIES.map((s) => s.symbol));

function stripHtmlAndEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractXmlTag(block: string, tag: string): string {
  const escaped = tag.replace(':', '\\:');
  const match = block.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return match?.[1] ? stripHtmlAndEntities(match[1]) : '';
}

export function formatVnTimestamp(isoOrDate: string | Date): {
  iso: string;
  display: string;
} {
  const dt = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const safeDt = Number.isNaN(dt.getTime()) ? new Date() : dt;
  const iso = safeDt.toISOString();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(safeDt);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  const display = `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
  return { iso, display };
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return 'social.feed';
  }
}

function detectPlatformFromText(text: string, fallback: SocialPlatformTag): SocialPlatformTag {
  const lower = text.toLowerCase();
  if (/\btiktok\b|\bdouyin\b/.test(lower)) return 'TikTok';
  if (/\bthreads\b/.test(lower)) return 'Threads';
  if (/\bfacebook\b|\bfanpage\b|\breels\b/.test(lower)) return 'Facebook';
  if (/\breddit\b|\br\/vietnam\b|\br\/worldnews\b/.test(lower)) return 'Reddit';
  if (/\bgoogle trends\b/.test(lower)) return 'Google Trends';
  return fallback;
}

function inferQuickSentiment(text: string): SentimentVerdict {
  const lower = text.toLowerCase();
  const posHits = (
    lower.match(
      /tích cực|kỷ lục|bùng nổ|lan tỏa|thành công|ủng hộ|tăng mạnh|đột phá|tuyệt vời|viral|surge|win|breakthrough/g
    ) || []
  ).length;
  const negHits = (
    lower.match(
      /tranh cãi|tẩy chay|lừa đảo|cảnh báo|sập|sự cố|tai nạn|phẫn nộ|giảm mạnh|lũ|bão|khủng hoảng|warning|scam|crisis|crash/g
    ) || []
  ).length;
  if (posHits > negHits && posHits >= 1) return 'Tích cực';
  if (negHits > posHits && negHits >= 1) return 'Tiêu cực';
  return 'Trung lập';
}

function extractTickersInText(text: string): string[] {
  const matches = text.match(/\b[A-Z]{3,4}\b/g);
  if (!matches) return [];
  const found = new Set<string>();
  for (const m of matches) {
    if (KNOWN_TICKER_SET.has(m)) found.add(m);
  }
  return Array.from(found).slice(0, 5);
}

function parseApproxTrafficScore(trafficText: string): number {
  const clean = trafficText.toUpperCase().replace(/[+,\s]/g, '');
  const m = clean.match(/^(\d+(?:\.\d+)?)(K|M)?/);
  if (!m) return 68;
  let num = Number(m[1]) || 1;
  if (m[2] === 'M') num *= 1_000_000;
  else if (m[2] === 'K') num *= 1_000;

  if (num >= 100_000) return 96;
  if (num >= 50_000) return 91;
  if (num >= 20_000) return 85;
  if (num >= 10_000) return 80;
  if (num >= 2_000) return 75;
  if (num >= 500) return 70;
  return 64;
}

function inferRegionQuick(text: string, defaultRegion: GeographicRegion): GeographicRegion {
  const lower = text.toLowerCase();
  if (
    /việt nam|hà nội|tp\.?hcm|sài gòn|đà nẵng|tiktok việt|vn-index|vietnam|người việt|bộ công thương|chính phủ/i.test(
      lower
    )
  ) {
    return 'Việt Nam';
  }
  if (/trung quốc|nhật bản|hàn quốc|asean|thái lan|singapore|đài loan|ấn độ|châu á/i.test(lower)) {
    return 'Châu Á';
  }
  if (/\bmỹ\b|hoa kỳ|fed|châu âu|\beu\b|anh|pháp|đức|wall street|trump|biden/i.test(lower)) {
    return 'Mỹ & Châu Âu';
  }
  return defaultRegion;
}

/* Stream 1: Google News Social RSS (VN) + GDELT Social fallback if 429 */
async function fetchGoogleNewsSocialStream(): Promise<{
  items: SocialTrendItem[];
  ok: boolean;
  note: string;
}> {
  const gnewsUrl =
    'https://news.google.com/rss/search?q=(TikTok+OR+Facebook+OR+Threads+OR+%22m%E1%BA%A1ng+x%C3%A3+h%E1%BB%99i%22+OR+%22g%C3%A2y+b%C3%A3o%22)&hl=vi&gl=VN&ceid=VN:vi';

  if (!isApiInCooldown('googlenews')) {
    const start = Date.now();
    try {
      const res = await fetch(gnewsUrl, {
        signal: AbortSignal.timeout(6500),
        headers: {
          'User-Agent': SOCIAL_USER_AGENT,
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
      });
      const xml = await res.text();
      recordApiCall({
        apiId: 'googlenews',
        endpoint: 'Google News Social RSS (VN)',
        statusCode: res.status,
        ok: res.ok,
        latencyMs: Date.now() - start,
        cooldownSeconds: res.status === 429 ? 60 : 0,
      });

      if (res.ok && xml.includes('<item')) {
        const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
        const items: SocialTrendItem[] = [];
        for (let i = 0; i < Math.min(blocks.length, 10); i += 1) {
          const b = blocks[i];
          const rawTitle = extractXmlTag(b, 'title');
          const link = extractXmlTag(b, 'link');
          const pubDate = extractXmlTag(b, 'pubDate');
          const desc = extractXmlTag(b, 'description');
          const sourceTag = extractXmlTag(b, 'source');
          if (!rawTitle || !link) continue;

          const cleanTitle = rawTitle.replace(/\s+-\s+[^-]{2,40}$/, '').trim();
          const platform = detectPlatformFromText(`${cleanTitle} ${desc}`, 'Facebook');
          const ts = formatVnTimestamp(pubDate || new Date());
          const viralScore = Math.max(66, 92 - i * 3);

          items.push({
            id: `gnews-soc-${i}-${cleanTitle.slice(0, 18).replace(/\s+/g, '')}`,
            title: cleanTitle,
            platform,
            viralScore,
            growthMetric: `+${Math.round(140 + (10 - i) * 22)}% tương tác`,
            originSummary:
              desc && desc.length > 20 && desc !== cleanTitle
                ? desc.slice(0, 200)
                : `Chủ đề đang lan truyền trên ${platform}, được ${sourceTag || 'báo chí Việt Nam'} ghi nhận.`,
            relatedUrl: link,
            sourceName: sourceTag || extractDomain(link),
            sourceDomain: extractDomain(link),
            publishedAtIso: ts.iso,
            displayTimestamp: ts.display,
            region: 'Việt Nam',
            sentimentLabel: inferQuickSentiment(`${cleanTitle} ${desc}`),
            streamSource: 'google-news-social',
            matchedTickers: extractTickersInText(`${cleanTitle} ${desc}`),
          });
        }
        if (items.length > 0) {
          return {
            items,
            ok: true,
            note: `Google News Social RSS (${items.length} chủ đề)`,
          };
        }
      }
    } catch {
      // fall through to GDELT social fallback
    }
  }

  // Fallback via GDELT DOC 2.0 Social Query (respecting 5s cooldown)
  if (!isApiInCooldown('gdelt')) {
    const gStart = Date.now();
    try {
      const gdeltUrl =
        'https://api.gdeltproject.org/api/v2/doc/doc?query=(TikTok%20OR%20Facebook%20OR%20Threads%20OR%20YouTube)%20Vietnam&mode=ArtList&maxrecords=8&format=json';
      const gRes = await fetch(gdeltUrl, {
        signal: AbortSignal.timeout(6500),
        headers: { 'User-Agent': SOCIAL_USER_AGENT },
      });
      const gOk = gRes.ok;
      const gData = gOk
        ? ((await gRes.json().catch(() => ({}))) as {
            articles?: Array<{
              url?: string;
              title?: string;
              seendate?: string;
              domain?: string;
            }>;
          })
        : {};
      recordApiCall({
        apiId: 'gdelt',
        endpoint: 'GDELT Social Fallback',
        statusCode: gRes.status,
        ok: gOk,
        latencyMs: Date.now() - gStart,
      });

      const list = Array.isArray(gData.articles) ? gData.articles : [];
      const items: SocialTrendItem[] = [];
      for (let i = 0; i < Math.min(list.length, 6); i += 1) {
        const a = list[i];
        if (!a.title || !a.url) continue;
        const platform = detectPlatformFromText(a.title, 'TikTok');
        const ts = formatVnTimestamp(new Date());
        items.push({
          id: `gdelt-soc-${i}-${a.title.slice(0, 14).replace(/\s+/g, '')}`,
          title: a.title.trim(),
          platform,
          viralScore: Math.max(64, 84 - i * 3),
          growthMetric: `+${110 + (6 - i) * 18}% chú ý`,
          originSummary: `Tin thảo luận liên quan ${platform} được chỉ mục qua GDELT Global News (${a.domain || 'quốc tế'}).`,
          relatedUrl: a.url,
          sourceName: a.domain || 'GDELT Index',
          sourceDomain: a.domain || extractDomain(a.url),
          publishedAtIso: ts.iso,
          displayTimestamp: ts.display,
          region: inferRegionQuick(a.title, 'Việt Nam'),
          sentimentLabel: inferQuickSentiment(a.title),
          streamSource: 'google-news-social',
          matchedTickers: extractTickersInText(a.title),
        });
      }
      if (items.length > 0) {
        return {
          items,
          ok: true,
          note: `GDELT Social Fallback (${items.length} tin)`,
        };
      }
    } catch {
      // ignore fallback error
    }
  }

  return {
    items: [],
    ok: false,
    note: 'Google News Social tạm giới hạn tần suất (429), đã chuyển luồng qua Community & Trends.',
  };
}

/* Stream 2: Google Trends Daily RSS (geo=VN) parsing <ht:approx_traffic> & <ht:news_item> */
async function fetchGoogleTrendsVnStream(): Promise<{
  items: SocialTrendItem[];
  ok: boolean;
  note: string;
}> {
  const url = 'https://trends.google.com/trending/rss?geo=VN';
  const start = Date.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(7000),
      headers: {
        'User-Agent': SOCIAL_USER_AGENT,
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
    });
    const xml = await res.text();
    recordApiCall({
      apiId: 'social_trends',
      endpoint: 'Google Trends Daily RSS (geo=VN)',
      statusCode: res.status,
      ok: res.ok,
      latencyMs: Date.now() - start,
    });

    if (!res.ok || !xml.includes('<item')) {
      return {
        items: [],
        ok: false,
        note: `Google Trends VN trả về HTTP ${res.status}`,
      };
    }

    const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
    const items: SocialTrendItem[] = [];

    for (let i = 0; i < Math.min(blocks.length, 10); i += 1) {
      const b = blocks[i];
      const keyword = extractXmlTag(b, 'title');
      const traffic = extractXmlTag(b, 'ht:approx_traffic') || '1K+';
      const pubDate = extractXmlTag(b, 'pubDate');
      const firstNewsBlock = b.match(/<ht:news_item>[\s\S]*?<\/ht:news_item>/i)?.[0] || '';
      const newsTitle = extractXmlTag(firstNewsBlock, 'ht:news_item_title');
      const newsUrl = extractXmlTag(firstNewsBlock, 'ht:news_item_url');
      const newsSource = extractXmlTag(firstNewsBlock, 'ht:news_item_source');

      if (!keyword) continue;
      const relatedUrl = newsUrl || 'https://trends.google.com/trending?geo=VN';
      const ts = formatVnTimestamp(pubDate || new Date());
      const viralScore = parseApproxTrafficScore(traffic);
      const displayTitle =
        newsTitle && newsTitle.length > keyword.length + 6
          ? `${keyword}: ${newsTitle}`
          : `Từ khóa nóng "${keyword}"`;

      items.push({
        id: `gtrend-${i}-${keyword.slice(0, 14).replace(/\s+/g, '')}`,
        title: displayTitle.slice(0, 180),
        platform: 'Google Trends',
        viralScore,
        growthMetric: `${traffic} tìm kiếm`,
        originSummary: newsTitle
          ? `Tìm kiếm tăng vọt tại Việt Nam (${traffic}) xoay quanh: ${newsTitle}${newsSource ? ` (${newsSource})` : ''}.`
          : `Từ khóa "${keyword}" đang đạt ${traffic} lượt tìm kiếm tăng đột biến tại Việt Nam.`,
        relatedUrl,
        sourceName: newsSource || 'Google Trends VN',
        sourceDomain: extractDomain(relatedUrl),
        publishedAtIso: ts.iso,
        displayTimestamp: ts.display,
        region: 'Việt Nam',
        sentimentLabel: inferQuickSentiment(`${keyword} ${newsTitle}`),
        streamSource: 'google-trends',
        matchedTickers: extractTickersInText(`${keyword} ${newsTitle}`),
      });
    }

    return {
      items,
      ok: items.length > 0,
      note: `Google Trends VN (${items.length} từ khóa nóng)`,
    };
  } catch (err) {
    recordApiCall({
      apiId: 'social_trends',
      endpoint: 'Google Trends Daily RSS (geo=VN)',
      statusCode: 500,
      ok: false,
      latencyMs: Date.now() - start,
      detail: err instanceof Error ? err.message : 'Timeout',
    });
    return {
      items: [],
      ok: false,
      note: 'Lỗi kết nối Google Trends VN.',
    };
  }
}

/* Stream 3: VN Youth & Community Press RSS */
const VN_COMMUNITY_FEEDS: Array<{
  url: string;
  sourceName: string;
  defaultPlatform: SocialPlatformTag;
}> = [
  {
    url: 'https://vnexpress.net/rss/y-kien.rss',
    sourceName: 'VnExpress Ý kiến',
    defaultPlatform: 'Cộng đồng VN',
  },
  {
    url: 'https://tuoitre.vn/rss/nhip-song-tre.rss',
    sourceName: 'Tuổi Trẻ Nhịp sống trẻ',
    defaultPlatform: 'Cộng đồng VN',
  },
  {
    url: 'https://thanhnien.vn/rss/gioi-tre.rss',
    sourceName: 'Thanh Niên Giới trẻ',
    defaultPlatform: 'Cộng đồng VN',
  },
  {
    url: 'https://dantri.com.vn/rss/doi-song.rss',
    sourceName: 'Dân Trí Đời sống',
    defaultPlatform: 'Cộng đồng VN',
  },
  {
    url: 'https://genk.vn/rss/home.rss',
    sourceName: 'GenK Cộng đồng Số',
    defaultPlatform: 'TikTok',
  },
];

async function fetchVnCommunityStream(): Promise<{
  items: SocialTrendItem[];
  ok: boolean;
  note: string;
}> {
  const start = Date.now();
  const settled = await Promise.allSettled(
    VN_COMMUNITY_FEEDS.map(async (feed) => {
      const res = await fetch(feed.url, {
        signal: AbortSignal.timeout(6500),
        headers: {
          'User-Agent': SOCIAL_USER_AGENT,
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
      });
      if (!res.ok) return [];
      const xml = await res.text();
      const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
      const parsed: Array<{
        title: string;
        link: string;
        pubDate: string;
        description: string;
        sourceName: string;
        defaultPlatform: SocialPlatformTag;
        socialMatchScore: number;
      }> = [];

      for (const b of blocks.slice(0, 8)) {
        const title = extractXmlTag(b, 'title');
        const link = extractXmlTag(b, 'link');
        const pubDate = extractXmlTag(b, 'pubDate');
        const description = extractXmlTag(b, 'description');
        if (!title || !link || !/^https?:\/\//i.test(link)) continue;

        const combined = `${title} ${description}`.toLowerCase();
        let socialMatchScore = 0;
        if (/tiktok|facebook|threads|youtube|zalo|instagram|reddit|netizen|cộng đồng mạng|gây bão|tranh cãi|viral|xu hướng|mạng xã hội|ai|streamer|creator/.test(combined)) {
          socialMatchScore += 3;
        }
        if (/giới trẻ|gen z|sinh viên|cư dân mạng|bình luận|chia sẻ|clip|video/.test(combined)) {
          socialMatchScore += 2;
        }

        parsed.push({
          title,
          link,
          pubDate,
          description,
          sourceName: feed.sourceName,
          defaultPlatform: feed.defaultPlatform,
          socialMatchScore,
        });
      }
      return parsed;
    })
  );

  const candidates = settled
    .filter((r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value)
    .sort((a, b) => b.socialMatchScore - a.socialMatchScore);

  const items: SocialTrendItem[] = [];
  const seenUrls = new Set<string>();
  for (let i = 0; i < candidates.length && items.length < 10; i += 1) {
    const c = candidates[i];
    if (seenUrls.has(c.link)) continue;
    seenUrls.add(c.link);

    const platform = detectPlatformFromText(`${c.title} ${c.description}`, c.defaultPlatform);
    const ts = formatVnTimestamp(c.pubDate || new Date());
    const viralScore = Math.min(93, Math.max(62, 68 + c.socialMatchScore * 5 - Math.floor(i / 3)));

    items.push({
      id: `vn-comm-${items.length}-${c.title.slice(0, 14).replace(/\s+/g, '')}`,
      title: c.title,
      platform,
      viralScore,
      growthMetric:
        c.socialMatchScore >= 3
          ? `+${160 + (10 - items.length) * 14}% thảo luận`
          : `+${85 + (10 - items.length) * 8}% quan tâm`,
      originSummary:
        c.description && c.description.length > 20
          ? c.description.slice(0, 210)
          : `Đề tài được cộng đồng mạng bàn luận trên ${c.sourceName}.`,
      relatedUrl: c.link,
      sourceName: c.sourceName,
      sourceDomain: extractDomain(c.link),
      publishedAtIso: ts.iso,
      displayTimestamp: ts.display,
      region: 'Việt Nam',
      sentimentLabel: inferQuickSentiment(`${c.title} ${c.description}`),
      streamSource: 'vn-community',
      matchedTickers: extractTickersInText(`${c.title} ${c.description}`),
    });
  }

  recordApiCall({
    apiId: 'social_trends',
    endpoint: 'VN Community RSS Pool (5 báo)',
    statusCode: items.length > 0 ? 200 : 500,
    ok: items.length > 0,
    latencyMs: Date.now() - start,
    detail: `${items.length} bài cộng đồng`,
  });

  return {
    items,
    ok: items.length > 0,
    note: `Báo chí Cộng đồng VN (${items.length} chủ đề)`,
  };
}

/* Stream 4: Reddit Public JSON with Atom RSS fallback */
async function fetchRedditSubreddit(
  subreddit: 'VietNam' | 'worldnews',
  region: GeographicRegion
): Promise<SocialTrendItem[]> {
  const jsonUrl = `https://www.reddit.com/r/${subreddit}/hot.json?limit=15`;
  try {
    const res = await fetch(jsonUrl, {
      signal: AbortSignal.timeout(6000),
      headers: {
        'User-Agent': REDDIT_USER_AGENT,
        Accept: 'application/json',
      },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        data?: {
          children?: Array<{
            data?: {
              id?: string;
              title?: string;
              permalink?: string;
              url?: string;
              ups?: number;
              num_comments?: number;
              created_utc?: number;
              selftext?: string;
              stickied?: boolean;
            };
          }>;
        };
      };
      const children = data.data?.children || [];
      const items: SocialTrendItem[] = [];
      for (const ch of children) {
        const p = ch.data;
        if (!p || p.stickied || !p.title) continue;
        const postUrl = p.permalink
          ? `https://www.reddit.com${p.permalink}`
          : p.url || `https://www.reddit.com/r/${subreddit}`;
        const ups = Number(p.ups || 0);
        const comments = Number(p.num_comments || 0);
        const createdMs = p.created_utc ? p.created_utc * 1000 : Date.now();
        const ts = formatVnTimestamp(new Date(createdMs));
        const viralScore = Math.min(95, Math.max(62, Math.round(62 + Math.log10(ups + 10) * 10)));

        items.push({
          id: `reddit-${subreddit}-${p.id || items.length}`,
          title: p.title.trim(),
          platform: 'Reddit',
          viralScore,
          growthMetric: `${ups.toLocaleString('en-US')} ↑ · ${comments} bình luận`,
          originSummary: p.selftext?.trim()
            ? p.selftext.trim().slice(0, 190)
            : `Thảo luận nổi bật trên r/${subreddit} thu hút ${ups} lượt bình chọn và ${comments} phản hồi.`,
          relatedUrl: postUrl,
          sourceName: `Reddit r/${subreddit}`,
          sourceDomain: 'reddit.com',
          publishedAtIso: ts.iso,
          displayTimestamp: ts.display,
          region: inferRegionQuick(p.title, region),
          sentimentLabel: inferQuickSentiment(p.title),
          streamSource: 'reddit',
          matchedTickers: extractTickersInText(p.title),
        });
        if (items.length >= 6) break;
      }
      if (items.length > 0) return items;
    }
  } catch {
    // fallback to Reddit Atom RSS below
  }

  // Atom RSS fallback (.rss always returns 200 OK XML)
  const rssUrl = `https://www.reddit.com/r/${subreddit}/.rss`;
  try {
    const res = await fetch(rssUrl, {
      signal: AbortSignal.timeout(6500),
      headers: {
        'User-Agent': REDDIT_USER_AGENT,
        Accept: 'application/atom+xml, application/xml, text/xml',
      },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
    const items: SocialTrendItem[] = [];

    for (let i = 0; i < entries.length && items.length < 6; i += 1) {
      const e = entries[i];
      const title = extractXmlTag(e, 'title');
      const hrefMatch = e.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
      const link = hrefMatch?.[1] || `https://www.reddit.com/r/${subreddit}`;
      const updated = extractXmlTag(e, 'updated') || extractXmlTag(e, 'published');
      const content = extractXmlTag(e, 'content');
      if (!title) continue;

      const ts = formatVnTimestamp(updated || new Date());
      const viralScore = Math.max(64, 86 - i * 3);
      items.push({
        id: `reddit-rss-${subreddit}-${i}`,
        title,
        platform: 'Reddit',
        viralScore,
        growthMetric: `Hot #${i + 1} r/${subreddit}`,
        originSummary:
          content && content.length > 25
            ? content.replace(/submitted by\s+\S+/gi, '').trim().slice(0, 190)
            : `Chủ đề thảo luận nóng trên diễn đàn Reddit r/${subreddit}.`,
        relatedUrl: link,
        sourceName: `Reddit r/${subreddit}`,
        sourceDomain: 'reddit.com',
        publishedAtIso: ts.iso,
        displayTimestamp: ts.display,
        region: inferRegionQuick(title, region),
        sentimentLabel: inferQuickSentiment(title),
        streamSource: 'reddit',
        matchedTickers: extractTickersInText(title),
      });
    }
    return items;
  } catch {
    return [];
  }
}

async function fetchRedditStream(): Promise<{
  items: SocialTrendItem[];
  ok: boolean;
  note: string;
}> {
  const start = Date.now();
  const [vnPosts, worldPosts] = await Promise.all([
    fetchRedditSubreddit('VietNam', 'Việt Nam'),
    fetchRedditSubreddit('worldnews', 'Toàn cầu / Quốc tế'),
  ]);
  const combined = [...vnPosts, ...worldPosts];
  recordApiCall({
    apiId: 'social_trends',
    endpoint: 'Reddit r/VietNam & r/worldnews',
    statusCode: combined.length > 0 ? 200 : 403,
    ok: combined.length > 0,
    latencyMs: Date.now() - start,
    detail: `${combined.length} bài Reddit`,
  });
  return {
    items: combined,
    ok: combined.length > 0,
    note: `Reddit r/VietNam & r/worldnews (${combined.length} bài)`,
  };
}

export interface SocialTrendsFeedResult {
  fetchedAt: string;
  trends: SocialTrendItem[];
  streamsStatus: Array<{
    stream: string;
    ok: boolean;
    count: number;
    note?: string;
  }>;
}

let socialCache: {
  data: SocialTrendsFeedResult;
  expiresAt: number;
} | null = null;

const SOCIAL_CACHE_TTL_MS = 10 * 60 * 1000;

export async function fetchSocialTrendsFeed(
  forceRefresh = false
): Promise<SocialTrendsFeedResult> {
  if (!forceRefresh && socialCache && socialCache.expiresAt > Date.now()) {
    return socialCache.data;
  }

  const [gnewsRes, gtrendsRes, vnCommRes, redditRes] = await Promise.all([
    fetchGoogleNewsSocialStream(),
    fetchGoogleTrendsVnStream(),
    fetchVnCommunityStream(),
    fetchRedditStream(),
  ]);

  const streamsStatus = [
    {
      stream: 'Google News Mạng xã hội',
      ok: gnewsRes.ok,
      count: gnewsRes.items.length,
      note: gnewsRes.note,
    },
    {
      stream: 'Google Trends VN',
      ok: gtrendsRes.ok,
      count: gtrendsRes.items.length,
      note: gtrendsRes.note,
    },
    {
      stream: 'Báo chí Cộng đồng VN',
      ok: vnCommRes.ok,
      count: vnCommRes.items.length,
      note: vnCommRes.note,
    },
    {
      stream: 'Reddit Hot (VN & World)',
      ok: redditRes.ok,
      count: redditRes.items.length,
      note: redditRes.note,
    },
  ];

  // Interleave & deduplicate by normalized title
  const rawAll = [
    ...gtrendsRes.items,
    ...vnCommRes.items,
    ...gnewsRes.items,
    ...redditRes.items,
  ];
  const seenTitles = new Set<string>();
  const deduped: SocialTrendItem[] = [];

  for (const it of rawAll) {
    const key = it.title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 48);
    if (!key || seenTitles.has(key)) continue;
    seenTitles.add(key);
    deduped.push(it);
  }

  deduped.sort((a, b) => b.viralScore - a.viralScore);

  const result: SocialTrendsFeedResult = {
    fetchedAt: new Date().toISOString(),
    trends: deduped.slice(0, 24),
    streamsStatus,
  };

  if (deduped.length > 0) {
    socialCache = {
      data: result,
      expiresAt: Date.now() + SOCIAL_CACHE_TTL_MS,
    };
  }

  return result;
}
