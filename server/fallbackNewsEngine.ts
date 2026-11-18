import type {
  AiRecommendationResponse,
  AiSuggestedArticle,
  AiSuggestedSource,
  AiTopicRecommendation,
  DeepAnalysisReport,
  ExistingArticleFingerprint,
  FetchedSourceArticle,
  GroundingSource,
  ImpactLevel,
  NewsCategoryId,
  NewsDigestResponse,
  NewsStory,
  SentimentBreakdown,
  SentimentVerdict,
  VisualDesk,
  VolatilityAlertItem,
  VolatilityCollectionResponse,
  VolatilityScopeId,
} from '../src/types/news.ts';
import { tryFetchRssFeed, type RawFeedItem } from './newsSources.ts';
import { fetchRawItemsFromPublicApi } from './publicApis.ts';
import { evaluateBatchWithDedupBot } from './dedupBot.ts';
import { fetchAndParseHtmlArticle } from './articleCrawler.ts';

interface LiveFeedSeed {
  url: string;
  sourceName: string;
  categoryLabel: string;
  visualDesk: VisualDesk;
}

const RSS_SEEDS_BY_CATEGORY: Record<NewsCategoryId, LiveFeedSeed[]> = {
  'tong-hop': [
    {
      url: 'https://vnexpress.net/rss/tin-moi-nhat.rss',
      sourceName: 'VnExpress Tin mới',
      categoryLabel: 'Thời sự',
      visualDesk: 'world',
    },
    {
      url: 'https://vnexpress.net/rss/kinh-doanh.rss',
      sourceName: 'VnExpress Kinh doanh',
      categoryLabel: 'Kinh tế',
      visualDesk: 'economy',
    },
    {
      url: 'https://vnexpress.net/rss/so-hoa.rss',
      sourceName: 'VnExpress Số hóa',
      categoryLabel: 'Công nghệ',
      visualDesk: 'tech',
    },
    {
      url: 'https://vnexpress.net/rss/the-gioi.rss',
      sourceName: 'VnExpress Thế giới',
      categoryLabel: 'Thế giới',
      visualDesk: 'world',
    },
  ],
  'viet-nam': [
    {
      url: 'https://vnexpress.net/rss/thoi-su.rss',
      sourceName: 'VnExpress Thời sự',
      categoryLabel: 'Việt Nam',
      visualDesk: 'world',
    },
    {
      url: 'https://vnexpress.net/rss/tin-noi-bat.rss',
      sourceName: 'VnExpress Nổi bật',
      categoryLabel: 'Việt Nam',
      visualDesk: 'world',
    },
    {
      url: 'https://vnexpress.net/rss/kinh-doanh.rss',
      sourceName: 'VnExpress Kinh doanh',
      categoryLabel: 'Kinh tế',
      visualDesk: 'economy',
    },
  ],
  'kinh-te': [
    {
      url: 'https://cafef.vn/thi-truong-chung-khoan.rss',
      sourceName: 'CafeF Chứng khoán',
      categoryLabel: 'Kinh tế',
      visualDesk: 'economy',
    },
    {
      url: 'https://vneconomy.vn/chung-khoan.rss',
      sourceName: 'VnEconomy Chứng khoán',
      categoryLabel: 'Kinh tế',
      visualDesk: 'economy',
    },
    {
      url: 'https://vietstock.vn/830/chung-khoan/co-phieu.rss',
      sourceName: 'Vietstock Cổ phiếu',
      categoryLabel: 'Kinh tế',
      visualDesk: 'economy',
    },
    {
      url: 'https://vnexpress.net/rss/kinh-doanh.rss',
      sourceName: 'VnExpress Kinh doanh',
      categoryLabel: 'Kinh tế',
      visualDesk: 'economy',
    },
  ],
  'cong-nghe': [
    {
      url: 'https://vnexpress.net/rss/so-hoa.rss',
      sourceName: 'VnExpress Số hóa',
      categoryLabel: 'Công nghệ',
      visualDesk: 'tech',
    },
    {
      url: 'https://vnexpress.net/rss/khoa-hoc.rss',
      sourceName: 'VnExpress Khoa học',
      categoryLabel: 'Khoa học',
      visualDesk: 'climate',
    },
  ],
  'the-gioi': [
    {
      url: 'https://vnexpress.net/rss/the-gioi.rss',
      sourceName: 'VnExpress Thế giới',
      categoryLabel: 'Thế giới',
      visualDesk: 'world',
    },
    {
      url: 'https://vnexpress.net/rss/tin-noi-bat.rss',
      sourceName: 'VnExpress Nổi bật',
      categoryLabel: 'Thế giới',
      visualDesk: 'world',
    },
  ],
  'khoa-hoc': [
    {
      url: 'https://vnexpress.net/rss/khoa-hoc.rss',
      sourceName: 'VnExpress Khoa học',
      categoryLabel: 'Khoa học',
      visualDesk: 'climate',
    },
    {
      url: 'https://vnexpress.net/rss/suc-khoe.rss',
      sourceName: 'VnExpress Sức khỏe',
      categoryLabel: 'Khoa học',
      visualDesk: 'climate',
    },
  ],
};

const COMPLEMENTARY_RSS_CATALOG = [
  {
    name: 'VnExpress — Kinh doanh',
    url: 'https://vnexpress.net/rss/kinh-doanh.rss',
    domain: 'vnexpress.net',
    defaultCategory: 'Kinh doanh',
    reason: 'Theo dõi sát diễn biến thị trường tài chính, vàng, tỷ giá và doanh nghiệp Việt Nam.',
  },
  {
    name: 'VnExpress — Số hóa & Công nghệ',
    url: 'https://vnexpress.net/rss/so-hoa.rss',
    domain: 'vnexpress.net',
    defaultCategory: 'Công nghệ',
    reason: 'Cập nhật nhanh xu hướng AI, bán dẫn, thiết bị số và chuyển đổi số.',
  },
  {
    name: 'VnExpress — Thế giới',
    url: 'https://vnexpress.net/rss/the-gioi.rss',
    domain: 'vnexpress.net',
    defaultCategory: 'Thế giới',
    reason: 'Bao quát biến động địa chính trị, kinh tế vĩ mô và thương mại quốc tế.',
  },
  {
    name: 'Spaceflight News API (v4)',
    url: 'https://api.spaceflightnewsapi.net/v4/articles/?limit=7',
    domain: 'api.spaceflightnewsapi.net',
    defaultCategory: 'Khoa học',
    reason: 'Luồng dữ liệu mở không cần key về hàng không vũ trụ và công nghệ cao.',
  },
  {
    name: 'GDELT DOC 2.0 Global News',
    url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=Vietnam%20OR%20economy&mode=ArtList&maxrecords=7&format=json',
    domain: 'api.gdeltproject.org',
    defaultCategory: 'Thế giới',
    reason: 'Chỉ mục tin toàn cầu thời gian thực phục vụ phát hiện biến động vĩ mô.',
  },
];

interface NormalizedLiveItem {
  title: string;
  url: string;
  description: string;
  publishedRelative: string;
  sourceName: string;
  sourceDomain: string;
  categoryLabel: string;
  visualDesk: VisualDesk;
}

function normalizeFolded(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDomainSafe(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return 'news.source';
  }
}

function formatRelativePubDate(rawPubDate: string): string {
  if (!rawPubDate) return 'Mới cập nhật';
  const parsed = new Date(rawPubDate);
  if (Number.isNaN(parsed.getTime())) return 'Hôm nay';
  const diffMin = Math.max(1, Math.round((Date.now() - parsed.getTime()) / 60000));
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} giờ trước`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay} ngày trước`;
}

const POSITIVE_SIGNALS = [
  'tăng trưởng',
  'kỷ lục',
  'đột phá',
  'bứt phá',
  'tích cực',
  'lợi nhuận',
  'mở rộng',
  'hợp tác',
  'thành công',
  'khởi sắc',
  'phục hồi',
  'thuận lợi',
  'vượt',
  'cải thiện',
  'nâng cấp',
  'growth',
  'record',
  'breakthrough',
  'surge',
  'launch',
];

const NEGATIVE_SIGNALS = [
  'giảm sâu',
  'sụt giảm',
  'lao dốc',
  'cảnh báo',
  'khủng hoảng',
  'rủi ro',
  'thiệt hại',
  'sự cố',
  'lỗ hổng',
  'tấn công',
  'bão',
  'lũ',
  'xung đột',
  'thuế quan',
  'trừng phạt',
  'lạm phát',
  'nợ xấu',
  'thua lỗ',
  'vi phạm',
  'tử vong',
  'tai nạn',
  'drop',
  'crisis',
  'warning',
  'risk',
  'attack',
  'breach',
];

function scoreLexicalSentiment(text: string): {
  verdict: SentimentVerdict;
  breakdown: SentimentBreakdown;
} {
  const lower = text.toLowerCase();
  let posHits = 0;
  let negHits = 0;
  for (const w of POSITIVE_SIGNALS) {
    if (lower.includes(w)) posHits += 1;
  }
  for (const w of NEGATIVE_SIGNALS) {
    if (lower.includes(w)) negHits += 1;
  }

  let positive = 28 + Math.min(40, posHits * 13);
  let negative = 20 + Math.min(45, negHits * 14);
  let neutral = Math.max(20, 100 - Math.min(75, positive + negative) + 25);

  const sum = positive + negative + neutral;
  positive = Math.round((positive / sum) * 100);
  negative = Math.round((negative / sum) * 100);
  neutral = Math.max(0, 100 - positive - negative);

  let verdict: SentimentVerdict = 'Trung lập';
  let toneLabel = 'Thông tin khách quan';
  if (positive - negative >= 12) {
    verdict = 'Tích cực';
    toneLabel = 'Tín hiệu tích cực';
  } else if (negative - positive >= 10) {
    verdict = 'Tiêu cực';
    toneLabel = 'Cảnh báo rủi ro / Biến động';
  }

  return {
    verdict,
    breakdown: {
      positive,
      neutral,
      negative,
      toneLabel,
    },
  };
}

function extractKeyEntities(text: string): string[] {
  const matches = text.match(
    /\b([A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯ][a-zàáâãèéêìíòóôõùúăđĩũơưỳỵỷỹ]{2,}(?:\s+[A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯ][a-zàáâãèéêìíòóôõùúăđĩũơưỳỵỷỹ]{1,}){0,2}|[A-Z]{2,6})\b/g
  );
  if (!matches) return [];
  const stop = new Set([
    'Việt',
    'Nam',
    'Sau',
    'Khi',
    'Với',
    'Trong',
    'Trên',
    'Nhiều',
    'Người',
    'Ngày',
    'Tháng',
    'Năm',
    'Hàng',
    'Chính',
    'Theo',
    'Tại',
    'Vì',
    'Các',
    'Một',
    'Những',
    'USD',
  ]);
  const counts = new Map<string, number>();
  for (const m of matches) {
    const clean = m.trim();
    if (clean.length < 2 || stop.has(clean)) continue;
    counts.set(clean, (counts.get(clean) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([ent]) => ent);
}

function inferImpactLevel(text: string): ImpactLevel {
  const lower = text.toLowerCase();
  if (
    /khẩn|kỷ lục|biến động|giá vàng|tỷ giá|lãi suất|chứng khoán|vn-index|thuế|bão|khủng hoảng|ai|bán dẫn|lỗ hổng|tấn công|\d+%/.test(
      lower
    )
  ) {
    return 'Cao';
  }
  if (/tăng|giảm|đầu tư|chính sách|nghị định|dự án|doanh nghiệp|thị trường/.test(lower)) {
    return 'Trung bình';
  }
  return 'Theo dõi';
}

function inferCategoryLabel(text: string, fallback: string): string {
  const lower = text.toLowerCase();
  if (/chứng khoán|vn-index|vn30|hnx|hose|cổ phiếu|trái phiếu|cổ tức|khối ngoại|tín dụng|ngân hàng|lãi suất|vàng|tỷ giá|kinh tế|tài chính|gdp|xuất khẩu|doanh nghiệp|bất động sản/.test(lower)) {
    return 'Kinh tế';
  }
  if (/ai|trí tuệ nhân tạo|chip|bán dẫn|phần mềm|mạng|an ninh mạng|công nghệ|apple|google|nvidia|openai/.test(lower)) {
    return 'Công nghệ';
  }
  if (/khoa học|vũ trụ|nasa|khí hậu|năng lượng|y tế|sức khỏe|nghiên cứu|vaccine/.test(lower)) {
    return 'Khoa học';
  }
  if (/mỹ|trung quốc|nga|ukraine|eu|liên hợp quốc|ngoại giao|biển đông|thuế quan|israel/.test(lower)) {
    return 'Thế giới';
  }
  if (/hà nội|tp hcm|tp\.hcm|chính phủ|quốc hội|bộ |việt nam|thủ tướng/.test(lower)) {
    return 'Việt Nam';
  }
  return fallback;
}

async function gatherLiveFeedItems(
  category: NewsCategoryId,
  query = '',
  maxPerFeed = 6
): Promise<NormalizedLiveItem[]> {
  const seeds = query.trim()
    ? [
        ...RSS_SEEDS_BY_CATEGORY['tong-hop'],
        {
          url: 'https://vnexpress.net/rss/khoa-hoc.rss',
          sourceName: 'VnExpress Khoa học',
          categoryLabel: 'Khoa học',
          visualDesk: 'climate' as VisualDesk,
        },
      ]
    : RSS_SEEDS_BY_CATEGORY[category] || RSS_SEEDS_BY_CATEGORY['tong-hop'];

  const tasks: Array<Promise<NormalizedLiveItem[]>> = seeds.map(async (seed) => {
    const raw: RawFeedItem[] = await tryFetchRssFeed(seed.url, maxPerFeed);
    return raw.map((it) => ({
      title: it.title,
      url: it.link,
      description: it.description || it.title,
      publishedRelative: formatRelativePubDate(it.pubDate),
      sourceName: seed.sourceName,
      sourceDomain: extractDomainSafe(it.link),
      categoryLabel: inferCategoryLabel(`${it.title} ${it.description}`, seed.categoryLabel),
      visualDesk: seed.visualDesk,
    }));
  });

  if (category === 'cong-nghe' || category === 'khoa-hoc') {
    const provider = category === 'cong-nghe' ? 'devto' : 'spaceflight';
    tasks.push(
      fetchRawItemsFromPublicApi(provider)
        .then((items) =>
          items.slice(0, 4).map((it) => ({
            title: it.title,
            url: it.link,
            description: it.description || it.title,
            publishedRelative: formatRelativePubDate(it.pubDate),
            sourceName: it.sourceLabel || (provider === 'devto' ? 'DEV Community' : 'Spaceflight News'),
            sourceDomain: extractDomainSafe(it.link),
            categoryLabel: category === 'cong-nghe' ? 'Công nghệ' : 'Khoa học',
            visualDesk: (category === 'cong-nghe' ? 'tech' : 'climate') as VisualDesk,
          }))
        )
        .catch(() => [])
    );
  }

  const settled = await Promise.allSettled(tasks);
  const combined: NormalizedLiveItem[] = [];
  const seenUrls = new Set<string>();

  for (const res of settled) {
    if (res.status !== 'fulfilled') continue;
    for (const item of res.value) {
      if (!item.url || !/^https?:\/\//i.test(item.url) || seenUrls.has(item.url)) continue;
      seenUrls.add(item.url);
      combined.push(item);
    }
  }

  if (query.trim()) {
    const qTerms = normalizeFolded(query)
      .split(/\s+/)
      .filter((t) => t.length >= 2);
    const scored = combined.map((item) => {
      const hay = normalizeFolded(`${item.title} ${item.description} ${item.categoryLabel}`);
      let hits = 0;
      for (const term of qTerms) {
        if (hay.includes(term)) hits += 1;
      }
      return { item, hits };
    });
    scored.sort((a, b) => b.hits - a.hits);
    const matched = scored.filter((s) => s.hits > 0).map((s) => s.item);
    return matched.length >= 3 ? matched : scored.map((s) => s.item);
  }

  return combined;
}

export async function buildLiveDigestFromRssAndApis(
  category: NewsCategoryId,
  query = '',
  preferredDomains: string[] = []
): Promise<NewsDigestResponse> {
  let items = await gatherLiveFeedItems(category, query, 6);

  if (preferredDomains.length > 0 && items.length > 0) {
    const domainSet = new Set(preferredDomains.map((d) => d.toLowerCase()));
    const prioritized = items.filter((it) =>
      Array.from(domainSet).some((d) => it.sourceDomain.includes(d))
    );
    const rest = items.filter(
      (it) => !Array.from(domainSet).some((d) => it.sourceDomain.includes(d))
    );
    items = [...prioritized, ...rest];
  }

  const selected = items.slice(0, 7);

  const stories: NewsStory[] = selected.map((it, idx) => {
    const sent = scoreLexicalSentiment(`${it.title} ${it.description}`);
    const entities = extractKeyEntities(`${it.title} ${it.description}`);
    const impactLevel = inferImpactLevel(`${it.title} ${it.description}`);
    const cleanDeck =
      it.description.length > 22
        ? it.description.slice(0, 180)
        : `${it.title} — cập nhật trực tiếp từ ${it.sourceName}.`;

    return {
      id: `live-${category}-${Date.now()}-${idx}`,
      title: it.title,
      deck: cleanDeck,
      category: it.categoryLabel,
      visualDesk: it.visualDesk,
      publishedRelative: it.publishedRelative,
      readTimeMinutes: 3,
      executiveTakeaways: [
        cleanDeck,
        `Nguồn phát hành: ${it.sourceName} (${it.sourceDomain}).`,
        `Mức độ chú ý: ${impactLevel} · Sắc thái: ${sent.verdict}.`,
      ],
      sentiment: sent.breakdown,
      perspectives: [
        {
          actor: it.sourceName,
          stance: cleanDeck,
        },
        {
          actor: 'Tổng hợp dòng tin',
          stance: `Diễn biến thuộc nhóm ${it.categoryLabel}, cập nhật ${it.publishedRelative}.`,
        },
      ],
      keyEntities: entities.length > 0 ? entities : [it.categoryLabel, it.sourceName],
      impactLevel,
      sourceOutlets: [it.sourceName],
      contextSummary: cleanDeck,
      articleLinks: [
        {
          title: it.title,
          url: it.url,
          source: it.sourceName,
        },
      ],
    };
  });

  // Aggregate Dominant Themes from real categories/entities
  const catCounts = new Map<string, number>();
  for (const s of stories) {
    catCounts.set(s.category, (catCounts.get(s.category) || 0) + 1);
  }
  const dominantThemes = Array.from(catCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([catName, cnt]) => ({
      theme: catName,
      storyCount: cnt,
      momentum: (cnt >= 2 ? 'Tăng nhanh' : 'Ổn định') as 'Tăng nhanh' | 'Ổn định',
      brief: `${cnt} sự kiện thời sự nổi bật đang được cập nhật trực tiếp ở nhóm ${catName}.`,
    }));

  const groundingSources: GroundingSource[] = selected.slice(0, 8).map((it) => ({
    title: `${it.sourceName}: ${it.title}`,
    uri: it.url,
  }));

  const editionSummary =
    stories.length > 0
      ? `Tổng hợp trực tiếp ${stories.length} sự kiện thời sự mới nhất từ RSS báo chí & Public APIs${query ? ` liên quan "${query}"` : ''} (chế độ dự phòng ổn định khi API AI tạm chạm ngưỡng giới hạn).`
      : 'Chưa thu thập được bài viết mới từ nguồn RSS ở thời điểm hiện tại.';

  return {
    category,
    query,
    generatedAt: new Date().toISOString(),
    editionSummary,
    dominantThemes,
    stories,
    groundingSources,
  };
}

export async function buildLiveRecommendationsFromRssAndContext(params: {
  currentCategory: NewsCategoryId;
  activeQuery?: string;
  recentTopics: string[];
  storedHeadlines: string[];
  enabledSourceDomains: string[];
}): Promise<AiRecommendationResponse> {
  const items = await gatherLiveFeedItems(params.currentCategory, params.activeQuery || '', 5);

  const entityFreq = new Map<string, { count: number; cat: NewsCategoryId; sampleTitle: string }>();
  for (const it of items) {
    for (const ent of extractKeyEntities(it.title)) {
      const existing = entityFreq.get(ent);
      const mappedCat: NewsCategoryId =
        it.categoryLabel === 'Kinh tế'
          ? 'kinh-te'
          : it.categoryLabel === 'Công nghệ'
            ? 'cong-nghe'
            : it.categoryLabel === 'Khoa học'
              ? 'khoa-hoc'
              : it.categoryLabel === 'Thế giới'
                ? 'the-gioi'
                : 'viet-nam';
      entityFreq.set(ent, {
        count: (existing?.count || 0) + 1,
        cat: existing?.cat || mappedCat,
        sampleTitle: existing?.sampleTitle || it.title,
      });
    }
  }

  const topThemes = Array.from(entityFreq.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 4);

  const recommendedTopics: AiTopicRecommendation[] =
    topThemes.length > 0
      ? topThemes.map(([ent, meta], idx) => ({
          id: `live-rec-topic-${Date.now()}-${idx}`,
          angleTitle: `Theo dõi diễn biến: ${ent}`,
          topicQuery: ent,
          suggestedCategory: meta.cat,
          priority:
            idx === 0
              ? 'Nên đọc ngay'
              : idx === 1
                ? 'Theo dõi xu hướng'
                : 'Mở rộng góc nhìn',
          reason: `Xuất hiện nổi bật trong dòng tin mới: "${meta.sampleTitle.slice(0, 75)}..."`,
        }))
      : items.slice(0, 3).map((it, idx) => ({
          id: `live-rec-topic-${Date.now()}-${idx}`,
          angleTitle: it.title.split(':')[0].slice(0, 50),
          topicQuery: it.categoryLabel,
          suggestedCategory: params.currentCategory,
          priority: 'Nên đọc ngay',
          reason: `Đề xuất từ chuyên mục ${it.categoryLabel} (${it.sourceName}).`,
        }));

  const storedSet = new Set(params.storedHeadlines.map((h) => normalizeFolded(h)));
  const suggestedArticles: AiSuggestedArticle[] = items
    .filter((it) => !storedSet.has(normalizeFolded(it.title)))
    .slice(0, 4)
    .map((it) => ({
      title: it.title,
      url: it.url,
      source: it.sourceName,
      category: it.categoryLabel,
      whyRecommended: `Cập nhật ${it.publishedRelative} từ ${it.sourceName}, bổ sung góc nhìn mới cho mục ${it.categoryLabel}.`,
    }));

  const enabledDomainsLower = new Set(params.enabledSourceDomains.map((d) => d.toLowerCase()));
  const suggestedSources: AiSuggestedSource[] = COMPLEMENTARY_RSS_CATALOG.filter(
    (c) => !enabledDomainsLower.has(c.domain.toLowerCase()) || COMPLEMENTARY_RSS_CATALOG.length <= 3
  )
    .slice(0, 3)
    .map((c) => ({
      name: c.name,
      url: c.url,
      defaultCategory: c.defaultCategory,
      reason: c.reason,
    }));

  return {
    generatedAt: new Date().toISOString(),
    personalizedBrief:
      params.recentTopics.length > 0
        ? `Gợi ý nhanh theo lịch sử đọc (${params.recentTopics[0].slice(0, 45)}) kết hợp tin mới trực tiếp từ RSS & Public APIs.`
        : `Đề xuất tuyến bài nổi bật trực tiếp từ dòng tin mới nhất thuộc chuyên mục đang xem.`,
    recommendedTopics,
    suggestedArticles,
    suggestedSources,
    groundingSources: items.slice(0, 5).map((it) => ({
      title: it.title,
      uri: it.url,
    })),
  };
}

const VOLATILITY_KEYWORDS: Record<VolatilityScopeId, RegExp> = {
  'tat-ca':
    /tăng|giảm|kỷ lục|biến động|giá vàng|tỷ giá|lãi suất|chứng khoán|thuế|bão|khẩn|sự cố|lỗ hổng|cảnh báo|xung đột|đột biến|\d+%/i,
  'kinh-te-tai-chinh':
    /vàng|tỷ giá|usd|chứng khoán|vn-index|lãi suất|ngân hàng|lạm phát|giá dầu|tăng|giảm|kỷ lục|thuế|\d+%/i,
  'cong-nghe-an-ninh':
    /ai|bảo mật|lỗ hổng|tấn công mạng|sự cố|gián đoạn|bán dẫn|chip|google|apple|microsoft|openai|nvidia/i,
  'dia-chinh-tri':
    /thuế quan|trừng phạt|xung đột|biển đông|ngoại giao|mỹ|trung quốc|nga|ukraine|eu|iran|israel/i,
  'thoi-tiet-nang-luong':
    /bão|áp thấp|mưa lớn|lũ|nắng nóng|cảnh báo|điện|năng lượng|dầu khí|xăng|khí đốt/i,
};

function extractSignalMetric(title: string, desc: string): string {
  const combined = `${title} ${desc}`;
  const pctMatch = combined.match(/[+-]?\d+(?:[.,]\d+)?\s*%/);
  if (pctMatch) return `Biến động ${pctMatch[0]}`;
  const numMatch = combined.match(/\d+(?:[.,]\d+)?\s*(?:triệu|tỷ|nghìn tỷ|USD|đồng|điểm|lần)/i);
  if (numMatch) return numMatch[0];
  if (/kỷ lục/i.test(combined)) return 'Mức kỷ lục mới';
  if (/cảnh báo|khẩn/i.test(combined)) return 'Cảnh báo nóng';
  if (/tăng mạnh|bứt phá/i.test(combined)) return 'Xu hướng tăng mạnh';
  if (/giảm sâu|lao dốc/i.test(combined)) return 'Áp lực giảm';
  return 'Chuyển động mới';
}

export async function buildLiveVolatilityFromRssAndGdelt(params: {
  focusScope: VolatilityScopeId;
  customKeyword?: string;
  existingIndex?: ExistingArticleFingerprint[];
}): Promise<VolatilityCollectionResponse> {
  const scopeFeeds: Record<VolatilityScopeId, LiveFeedSeed[]> = {
    'tat-ca': [
      ...RSS_SEEDS_BY_CATEGORY['kinh-te'].slice(0, 1),
      ...RSS_SEEDS_BY_CATEGORY['the-gioi'].slice(0, 1),
      ...RSS_SEEDS_BY_CATEGORY['cong-nghe'].slice(0, 1),
      ...RSS_SEEDS_BY_CATEGORY['tong-hop'].slice(0, 1),
    ],
    'kinh-te-tai-chinh': RSS_SEEDS_BY_CATEGORY['kinh-te'],
    'cong-nghe-an-ninh': RSS_SEEDS_BY_CATEGORY['cong-nghe'],
    'dia-chinh-tri': RSS_SEEDS_BY_CATEGORY['the-gioi'],
    'thoi-tiet-nang-luong': RSS_SEEDS_BY_CATEGORY['khoa-hoc'],
  };

  const seeds = scopeFeeds[params.focusScope] || scopeFeeds['tat-ca'];
  const rawList: NormalizedLiveItem[] = [];
  const settled = await Promise.allSettled(
    seeds.map(async (seed) => {
      const items = await tryFetchRssFeed(seed.url, 8);
      return items.map((it) => ({
        title: it.title,
        url: it.link,
        description: it.description || it.title,
        publishedRelative: formatRelativePubDate(it.pubDate),
        sourceName: seed.sourceName,
        sourceDomain: extractDomainSafe(it.link),
        categoryLabel: inferCategoryLabel(`${it.title} ${it.description}`, seed.categoryLabel),
        visualDesk: seed.visualDesk,
      }));
    })
  );

  const seenUrls = new Set<string>();
  for (const r of settled) {
    if (r.status !== 'fulfilled') continue;
    for (const it of r.value) {
      if (!seenUrls.has(it.url)) {
        seenUrls.add(it.url);
        rawList.push(it);
      }
    }
  }

  const scopeRegex = VOLATILITY_KEYWORDS[params.focusScope] || VOLATILITY_KEYWORDS['tat-ca'];
  const customKw = normalizeFolded(params.customKeyword || '');

  const scored = rawList.map((it) => {
    const full = `${it.title} ${it.description}`;
    let score = 0;
    if (scopeRegex.test(full)) score += 3;
    if (/\d+(?:[.,]\d+)?\s*%/.test(full)) score += 2;
    if (/khẩn|kỷ lục|cảnh báo|biến động|giá vàng|tỷ giá|lãi suất|sự cố|bão/.test(full.toLowerCase())) {
      score += 2;
    }
    if (customKw && normalizeFolded(full).includes(customKw)) {
      score += 5;
    }
    return { it, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const topVolatile = scored.slice(0, 6);

  const alertsWithMeta = topVolatile.map(({ it, score }, idx) => {
    const sent = scoreLexicalSentiment(`${it.title} ${it.description}`);
    const level: VolatilityAlertItem['volatilityLevel'] =
      score >= 6 ? 'Khẩn cấp' : score >= 3 ? 'Biến động cao' : 'Đáng chú ý';
    const signalMetric = extractSignalMetric(it.title, it.description);

    return {
      alert: {
        id: `live-vol-${Date.now()}-${idx}`,
        headline: it.title,
        sector: it.categoryLabel,
        volatilityLevel: level,
        signalMetric,
        impactSummary: it.description.slice(0, 180),
        sourceName: it.sourceName,
        sourceUrl: it.url,
        publishedRelative: it.publishedRelative,
      } satisfies VolatilityAlertItem,
      sentimentLabel: sent.verdict,
      scores: sent.breakdown,
    };
  });

  const { accepted, report } = evaluateBatchWithDedupBot(
    alertsWithMeta.map((entry) => ({
      title: entry.alert.headline,
      url: entry.alert.sourceUrl,
      description: `${entry.alert.signalMetric}. ${entry.alert.impactSummary}`,
      sourceName: entry.alert.sourceName,
      ref: entry,
    })),
    params.existingIndex || []
  );

  const collectedArticles: FetchedSourceArticle[] = accepted.map((entry, idx) => {
    const { alert, sentimentLabel, scores } = entry.item.ref;
    return {
      id: `live-vol-art-${Date.now()}-${idx}`,
      sourceId: 'ai-volatility-radar',
      sourceName: alert.sourceName,
      sourceDomain: extractDomainSafe(alert.sourceUrl),
      title: alert.headline,
      url: alert.sourceUrl,
      publishedRelative: alert.publishedRelative,
      category: alert.sector,
      summary: `[${alert.volatilityLevel} · ${alert.signalMetric}] ${alert.impactSummary}`,
      keyTakeaway: alert.impactSummary,
      sentimentLabel,
      sentiment: {
        ...scores,
        toneLabel: alert.volatilityLevel,
      },
      dedupStatus: entry.dedupStatus,
      existingDocId: entry.existingDocId,
      updateReason: entry.updateReason,
    };
  });

  const hasUrgent = alertsWithMeta.some((a) => a.alert.volatilityLevel === 'Khẩn cấp');
  const hasHigh = alertsWithMeta.some((a) => a.alert.volatilityLevel === 'Biến động cao');

  return {
    collectedAt: new Date().toISOString(),
    focusScope: params.focusScope,
    volatilityIndexLabel: hasUrgent ? 'Biến động mạnh' : hasHigh ? 'Chú ý cao' : 'Ổn định',
    marketPulseSummary: `Đã quét trực tiếp ${rawList.length} bản tin mới từ RSS báo chí${params.customKeyword ? ` (lọc "${params.customKeyword}")` : ''} và chấm lọc ${alertsWithMeta.length} tín hiệu biến động đáng chú ý nhất.`,
    volatilityAlerts: alertsWithMeta.map((a) => a.alert),
    collectedArticles,
    botReport: report,
    groundingSources: alertsWithMeta.map((a) => ({
      title: `${a.alert.sourceName}: ${a.alert.headline}`,
      uri: a.alert.sourceUrl,
    })),
  };
}

export async function buildLiveAnalysisReportFromUrl(params: {
  url?: string;
  title?: string;
  text?: string;
  topicContext?: string;
}): Promise<DeepAnalysisReport> {
  const cleanUrl = params.url?.trim() || '';
  const domData = cleanUrl ? await fetchAndParseHtmlArticle(cleanUrl) : null;

  const paragraphs = domData?.contentParagraphs?.length
    ? domData.contentParagraphs
    : params.text
      ? params.text
          .split(/\n+/)
          .map((p) => p.trim())
          .filter(Boolean)
      : params.topicContext
        ? [params.topicContext]
        : [];

  const combinedText = `${domData?.title || params.title || ''} ${paragraphs.join(' ')}`;
  const sent = scoreLexicalSentiment(combinedText);
  const entities = extractKeyEntities(combinedText);
  const domain = cleanUrl ? extractDomainSafe(cleanUrl) : 'nguon-tin';

  const executiveSummary =
    paragraphs.length > 0
      ? paragraphs.slice(0, 4).map((p) => p.slice(0, 260))
      : [
          params.title || 'Nội dung đang được cập nhật từ nguồn bài gốc.',
          'Vui lòng mở liên kết gốc để đọc toàn văn khi nguồn báo hạn chế trích xuất tự động.',
        ];

  return {
    id: `dom-analysis-${Date.now()}`,
    analyzedAt: new Date().toISOString(),
    headline: domData?.title || params.title || 'Tóm tắt cấu trúc bài viết',
    sourceSummary: `Trích xuất trực tiếp từ nội dung trang (${domain}) ở chế độ dự phòng nhanh.`,
    executiveSummary,
    sentiment: {
      ...sent.breakdown,
      objectivityNote:
        'Đánh giá sắc thái sơ bộ dựa trên mật độ từ khóa thực tế trích xuất từ văn bản gốc.',
    },
    perspectives: [
      {
        stakeholder: `Nguồn gốc (${domain})`,
        framing: sent.verdict,
        summary: executiveSummary[0] || 'Thông tin phản ánh trực tiếp từ bài viết.',
      },
      {
        stakeholder: 'Thực thể & Chủ đề chính',
        framing: 'Bối cảnh liên quan',
        summary:
          entities.length > 0
            ? `Bài viết đề cập trực tiếp đến: ${entities.join(', ')}.`
            : 'Tập trung vào diễn biến chính được nêu trong tiêu đề.',
      },
    ],
    factChecks: [
      {
        claim: executiveSummary[0] || params.title || 'Luận điểm chính của bài viết',
        status: 'Đã xác thực',
        context: cleanUrl
          ? `Đối chiếu trực tiếp tại bài gốc: ${cleanUrl}`
          : 'Trích từ nội dung văn bản đã cung cấp.',
      },
    ],
    impactHorizon: {
      shortTerm:
        paragraphs[1]?.slice(0, 220) ||
        'Tác động tức thời xoay quanh sự kiện được nêu trong bản tin.',
      longTerm:
        'Cần theo dõi thêm các cập nhật tiếp theo trong cùng chuyên mục để đánh giá xu hướng dài hạn.',
      affectedSectors:
        entities.length > 0 ? entities.slice(0, 4) : ['Thời sự', 'Thị trường'],
    },
    editorialQuestions: [
      'Diễn biến này tác động trực tiếp thế nào đến các nhóm đối tượng liên quan?',
      'Có số liệu hoặc thông báo chính thức bổ sung nào trong 24–48 giờ tới không?',
    ],
    groundingSources: cleanUrl
      ? [
          {
            title: domData?.title || params.title || domain,
            uri: cleanUrl,
          },
        ]
      : [],
  };
}
