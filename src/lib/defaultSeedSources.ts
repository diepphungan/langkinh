import type {
  AutoFetchIntervalMinutes,
  NewsSourceConfig,
  PersistentSourcesState,
  TopicPackId,
  TopicPackMeta,
} from '../types/news';

export const SEED_ADDED_AT_ISO = '2026-01-01T00:00:00.000Z';

export const VALID_TOPIC_PACK_IDS: TopicPackId[] = [
  'thoi-su',
  'chung-khoan',
  'tai-chinh',
  'bat-dong-san',
  'cong-nghe',
  'the-gioi',
  'mang-xa-hoi',
  'watchlist',
];

export const DEFAULT_ACTIVE_TOPIC_PACKS: TopicPackId[] = [
  'thoi-su',
  'chung-khoan',
  'tai-chinh',
  'bat-dong-san',
  'cong-nghe',
  'the-gioi',
  'mang-xa-hoi',
  'watchlist',
];

export const OFFICIAL_TOPIC_PACK_CATALOG: TopicPackMeta[] = [
  {
    id: 'thoi-su',
    name: 'Thời sự & Chính sách Việt Nam',
    description:
      'VnExpress, Tuổi Trẻ, Thanh Niên, Dân Trí, VietnamPlus — cập nhật chính sách điều hành, xã hội và nghị sự trong nước.',
    feedCount: 6,
    sampleDomains: ['vnexpress.net', 'tuoitre.vn', 'thanhnien.vn', 'dantri.com.vn'],
  },
  {
    id: 'chung-khoan',
    name: 'Chứng khoán & Thị trường Vốn',
    description:
      'CafeF Chứng khoán, Vietstock, VnEconomy, Đầu Tư Chứng Khoán — gắn thẻ mã cổ phiếu HOSE/HNX/UPCOM tự động.',
    feedCount: 5,
    sampleDomains: ['cafef.vn', 'vietstock.vn', 'vneconomy.vn', 'tinnhanhchungkhoan.vn'],
  },
  {
    id: 'tai-chinh',
    name: 'Tài chính, Ngân hàng & Kinh tế Vĩ mô',
    description:
      'CafeF Tài chính - Ngân hàng & Vĩ mô, VnExpress Kinh doanh, VnEconomy Tài chính, Tuổi Trẻ Kinh doanh.',
    feedCount: 5,
    sampleDomains: ['cafef.vn', 'vnexpress.net', 'vneconomy.vn', 'tuoitre.vn'],
  },
  {
    id: 'bat-dong-san',
    name: 'Bất động sản & Hạ tầng',
    description:
      'CafeF Bất động sản, VnExpress, VnEconomy Địa ốc, Dân Trí, Vietstock — quy hoạch, dự án hạ tầng và thị trường nhà đất.',
    feedCount: 5,
    sampleDomains: ['cafef.vn', 'vnexpress.net', 'vneconomy.vn', 'dantri.com.vn'],
  },
  {
    id: 'cong-nghe',
    name: 'Công nghệ, AI & Chuyển đổi số',
    description:
      'VnExpress Số hóa & Khoa học, GenK, Thanh Niên Công nghệ, TechCrunch RSS và Hacker News Top Stories API.',
    feedCount: 6,
    sampleDomains: ['vnexpress.net', 'genk.vn', 'techcrunch.com', 'hacker-news.firebaseio.com'],
  },
  {
    id: 'the-gioi',
    name: 'Thế giới & Kinh tế Quốc tế',
    description:
      'VnExpress Thế giới, Tuổi Trẻ Thế giới, BBC News World và CNBC Top News — theo dõi kinh tế toàn cầu & địa chính trị.',
    feedCount: 4,
    sampleDomains: ['vnexpress.net', 'tuoitre.vn', 'bbc.co.uk', 'cnbc.com'],
  },
  {
    id: 'mang-xa-hoi',
    name: 'Mạng xã hội & Xu hướng Cộng đồng',
    description:
      'Google Trends Daily Vietnam, VnExpress Cộng đồng, Tuổi Trẻ Nhịp sống trẻ và luồng Google News Viral Social VN.',
    feedCount: 4,
    sampleDomains: ['trends.google.com', 'vnexpress.net', 'tuoitre.vn', 'news.google.com'],
  },
  {
    id: 'watchlist',
    name: 'Watchlist & Từ khóa Động',
    description:
      'Tự động sinh & lưu bền vững luồng Google News RSS động theo từng mã cổ phiếu trong Watchlist và từ khóa theo dõi.',
    feedCount: 0,
    sampleDomains: ['news.google.com'],
  },
];

export const DEFAULT_SEED_SOURCES: NewsSourceConfig[] = [
  // 1. Thời sự & Chính sách Việt Nam (6)
  {
    id: 'seed-thoisu-vnexpress-moi',
    name: 'VnExpress Tin mới',
    url: 'https://vnexpress.net/rss/tin-moi-nhat.rss',
    domain: 'vnexpress.net',
    defaultCategory: 'Chính trị & Xã hội',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'thoi-su',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-thoisu-vnexpress-ts',
    name: 'VnExpress Thời sự',
    url: 'https://vnexpress.net/rss/thoi-su.rss',
    domain: 'vnexpress.net',
    defaultCategory: 'Chính trị & Xã hội',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'thoi-su',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-thoisu-tuoitre-ts',
    name: 'Tuổi Trẻ Thời sự',
    url: 'https://tuoitre.vn/rss/thoi-su.rss',
    domain: 'tuoitre.vn',
    defaultCategory: 'Chính trị & Xã hội',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'thoi-su',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-thoisu-thanhnien-ts',
    name: 'Thanh Niên Thời sự',
    url: 'https://thanhnien.vn/rss/thoi-su.rss',
    domain: 'thanhnien.vn',
    defaultCategory: 'Chính trị & Xã hội',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'thoi-su',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-thoisu-dantri-xh',
    name: 'Dân Trí Xã hội',
    url: 'https://dantri.com.vn/rss/xa-hoi.rss',
    domain: 'dantri.com.vn',
    defaultCategory: 'Chính trị & Xã hội',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'thoi-su',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-thoisu-vietnamplus-ct',
    name: 'VietnamPlus Chính trị - Xã hội',
    url: 'https://www.vietnamplus.vn/rss/chinh-tri.rss',
    domain: 'vietnamplus.vn',
    defaultCategory: 'Chính trị & Xã hội',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'thoi-su',
    kind: 'rss',
    origin: 'seed',
  },

  // 2. Chứng khoán & Thị trường Vốn (5)
  {
    id: 'seed-ck-cafef',
    name: 'CafeF Chứng khoán',
    url: 'https://cafef.vn/thi-truong-chung-khoan.rss',
    domain: 'cafef.vn',
    defaultCategory: 'Kinh doanh',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'chung-khoan',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-ck-vietstock-cp',
    name: 'Vietstock Chứng khoán',
    url: 'https://vietstock.vn/830/chung-khoan/co-phieu.rss',
    domain: 'vietstock.vn',
    defaultCategory: 'Kinh doanh',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'chung-khoan',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-ck-vietstock-nd',
    name: 'Vietstock Nhận định Thị trường',
    url: 'https://vietstock.vn/1636/nhan-dinh-phan-tich/nhan-dinh-thi-truong.rss',
    domain: 'vietstock.vn',
    defaultCategory: 'Kinh doanh',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'chung-khoan',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-ck-vneconomy',
    name: 'VnEconomy Chứng khoán',
    url: 'https://vneconomy.vn/chung-khoan.rss',
    domain: 'vneconomy.vn',
    defaultCategory: 'Kinh doanh',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'chung-khoan',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-ck-tinnhanh',
    name: 'Đầu Tư Chứng Khoán',
    url: 'https://www.tinnhanhchungkhoan.vn/rss/chung-khoan.rss',
    domain: 'tinnhanhchungkhoan.vn',
    defaultCategory: 'Kinh doanh',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'chung-khoan',
    kind: 'rss',
    origin: 'seed',
  },

  // 3. Tài chính, Ngân hàng & Kinh tế Vĩ mô (5)
  {
    id: 'seed-tc-cafef-nh',
    name: 'CafeF Tài chính - Ngân hàng',
    url: 'https://cafef.vn/tai-chinh-ngan-hang.rss',
    domain: 'cafef.vn',
    defaultCategory: 'Kinh doanh',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'tai-chinh',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-tc-cafef-vm',
    name: 'CafeF Kinh tế Vĩ mô',
    url: 'https://cafef.vn/vi-mo-dau-tu.rss',
    domain: 'cafef.vn',
    defaultCategory: 'Kinh doanh',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'tai-chinh',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-tc-vnexpress-kd',
    name: 'VnExpress Kinh doanh',
    url: 'https://vnexpress.net/rss/kinh-doanh.rss',
    domain: 'vnexpress.net',
    defaultCategory: 'Kinh doanh',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'tai-chinh',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-tc-vneconomy-tc',
    name: 'VnEconomy Tài chính',
    url: 'https://vneconomy.vn/tai-chinh.rss',
    domain: 'vneconomy.vn',
    defaultCategory: 'Kinh doanh',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'tai-chinh',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-tc-tuoitre-kd',
    name: 'Tuổi Trẻ Kinh doanh',
    url: 'https://tuoitre.vn/rss/kinh-doanh.rss',
    domain: 'tuoitre.vn',
    defaultCategory: 'Kinh doanh',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'tai-chinh',
    kind: 'rss',
    origin: 'seed',
  },

  // 4. Bất động sản & Hạ tầng (5)
  {
    id: 'seed-bds-cafef',
    name: 'CafeF Bất động sản',
    url: 'https://cafef.vn/bat-dong-san.rss',
    domain: 'cafef.vn',
    defaultCategory: 'Kinh doanh',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'bat-dong-san',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-bds-vnexpress',
    name: 'VnExpress Bất động sản',
    url: 'https://vnexpress.net/rss/bat-dong-san.rss',
    domain: 'vnexpress.net',
    defaultCategory: 'Kinh doanh',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'bat-dong-san',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-bds-vneconomy',
    name: 'VnEconomy Địa ốc',
    url: 'https://vneconomy.vn/dia-oc.rss',
    domain: 'vneconomy.vn',
    defaultCategory: 'Kinh doanh',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'bat-dong-san',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-bds-dantri',
    name: 'Dân Trí Bất động sản',
    url: 'https://dantri.com.vn/rss/bat-dong-san.rss',
    domain: 'dantri.com.vn',
    defaultCategory: 'Kinh doanh',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'bat-dong-san',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-bds-vietstock',
    name: 'Vietstock Bất động sản',
    url: 'https://vietstock.vn/763/bat-dong-san/thi-truong-nha-dat.rss',
    domain: 'vietstock.vn',
    defaultCategory: 'Kinh doanh',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'bat-dong-san',
    kind: 'rss',
    origin: 'seed',
  },

  // 5. Công nghệ, AI & Chuyển đổi số (6)
  {
    id: 'seed-tech-vnexpress-sh',
    name: 'VnExpress Số hóa',
    url: 'https://vnexpress.net/rss/so-hoa.rss',
    domain: 'vnexpress.net',
    defaultCategory: 'Công nghệ',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'cong-nghe',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-tech-vnexpress-kh',
    name: 'VnExpress Khoa học',
    url: 'https://vnexpress.net/rss/khoa-hoc.rss',
    domain: 'vnexpress.net',
    defaultCategory: 'Khoa học',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'cong-nghe',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-tech-genk',
    name: 'GenK Tin tức Công nghệ',
    url: 'https://genk.vn/rss/home.rss',
    domain: 'genk.vn',
    defaultCategory: 'Công nghệ',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'cong-nghe',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-tech-thanhnien',
    name: 'Thanh Niên Công nghệ',
    url: 'https://thanhnien.vn/rss/cong-nghe-game.rss',
    domain: 'thanhnien.vn',
    defaultCategory: 'Công nghệ',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'cong-nghe',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-tech-techcrunch',
    name: 'TechCrunch RSS',
    url: 'https://techcrunch.com/feed/',
    domain: 'techcrunch.com',
    defaultCategory: 'Công nghệ',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'cong-nghe',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-tech-hackernews',
    name: 'Hacker News Top Stories API',
    url: 'https://hacker-news.firebaseio.com/v0/topstories.json',
    domain: 'hacker-news.firebaseio.com',
    defaultCategory: 'Công nghệ',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'cong-nghe',
    kind: 'hackernews',
    origin: 'seed',
  },

  // 6. Thế giới & Kinh tế Quốc tế (4)
  {
    id: 'seed-world-vnexpress',
    name: 'VnExpress Thế giới',
    url: 'https://vnexpress.net/rss/the-gioi.rss',
    domain: 'vnexpress.net',
    defaultCategory: 'Thế giới',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'the-gioi',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-world-tuoitre',
    name: 'Tuổi Trẻ Thế giới',
    url: 'https://tuoitre.vn/rss/the-gioi.rss',
    domain: 'tuoitre.vn',
    defaultCategory: 'Thế giới',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'the-gioi',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-world-bbc',
    name: 'BBC News World',
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    domain: 'bbc.co.uk',
    defaultCategory: 'Thế giới',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'the-gioi',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-world-cnbc',
    name: 'CNBC Top News',
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114',
    domain: 'cnbc.com',
    defaultCategory: 'Kinh doanh',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'the-gioi',
    kind: 'rss',
    origin: 'seed',
  },

  // 7. Mạng xã hội & Xu hướng Cộng đồng (4)
  {
    id: 'seed-social-gtrends',
    name: 'Google Trends Daily Vietnam',
    url: 'https://trends.google.com/trending/rss?geo=VN',
    domain: 'trends.google.com',
    defaultCategory: 'Chính trị & Xã hội',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'mang-xa-hoi',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-social-vnexpress-cd',
    name: 'VnExpress Cộng đồng',
    url: 'https://vnexpress.net/rss/cong-dong.rss',
    domain: 'vnexpress.net',
    defaultCategory: 'Chính trị & Xã hội',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'mang-xa-hoi',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-social-tuoitre-nst',
    name: 'Tuổi Trẻ Nhịp sống trẻ',
    url: 'https://tuoitre.vn/rss/nhip-song-tre.rss',
    domain: 'tuoitre.vn',
    defaultCategory: 'Giải trí',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'mang-xa-hoi',
    kind: 'rss',
    origin: 'seed',
  },
  {
    id: 'seed-social-gnews-viral',
    name: 'Google News Viral Social VN',
    url: 'https://news.google.com/rss/search?q=(TikTok+OR+Facebook+OR+Threads+OR+"mạng+xã+hội"+OR+"gây+bão")&hl=vi&gl=VN&ceid=VN:vi',
    domain: 'news.google.com',
    defaultCategory: 'Chính trị & Xã hội',
    enabled: true,
    addedAt: SEED_ADDED_AT_ISO,
    packId: 'mang-xa-hoi',
    kind: 'googlenews',
    origin: 'seed',
  },
];

export function canonicalizeSourceUrl(rawUrl: string): string {
  return rawUrl.trim().replace(/\/+$/, '').toLowerCase();
}

export function buildGoogleNewsDynamicRssUrl(query: string): string {
  const encoded = encodeURIComponent(query.trim());
  return `https://news.google.com/rss/search?q=${encoded}&hl=vi&gl=VN&ceid=VN:vi`;
}

export function normalizeTopicPackIds(raw: unknown): TopicPackId[] {
  if (!Array.isArray(raw)) return [...DEFAULT_ACTIVE_TOPIC_PACKS];
  const validSet = new Set<TopicPackId>(VALID_TOPIC_PACK_IDS);
  const out = new Set<TopicPackId>();
  for (const item of raw) {
    const val = String(item || '').trim();
    if (val === 'finance') {
      out.add('chung-khoan');
      out.add('tai-chinh');
    } else if (val === 'macro') {
      out.add('thoi-su');
    } else if (val === 'tech') {
      out.add('cong-nghe');
    } else if (val === 'world') {
      out.add('the-gioi');
    } else if (validSet.has(val as TopicPackId)) {
      out.add(val as TopicPackId);
    }
  }
  return Array.from(out);
}

export function normalizeScanInterval(raw: unknown): AutoFetchIntervalMinutes {
  const num = Number(raw);
  if (num === 1 || num === 5 || num === 15 || num === 30 || num === 60) return num;
  return 15;
}

export function normalizeNewsSourceList(raw: unknown): NewsSourceConfig[] {
  if (!Array.isArray(raw)) return [];
  const seenUrls = new Set<string>();
  const out: NewsSourceConfig[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Partial<NewsSourceConfig>;
    const url = typeof obj.url === 'string' ? obj.url.trim() : '';
    if (!url || !/^https?:\/\/.+/i.test(url)) continue;
    const canon = canonicalizeSourceUrl(url);
    if (seenUrls.has(canon)) continue;
    seenUrls.add(canon);

    let domain = typeof obj.domain === 'string' ? obj.domain.trim() : '';
    if (!domain) {
      try {
        domain = new URL(url).hostname.replace(/^www\./, '');
      } catch {
        domain = 'news.source';
      }
    }

    const rawPack = obj.packId ? normalizeTopicPackIds([obj.packId])[0] : undefined;
    const safeId =
      typeof obj.id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(obj.id)
        ? obj.id
        : `src-${Math.abs(hashStr(canon))}`;

    out.push({
      id: safeId,
      name:
        typeof obj.name === 'string' && obj.name.trim().length > 0
          ? obj.name.trim().slice(0, 160)
          : domain,
      url: url.slice(0, 1000),
      domain: domain.slice(0, 120),
      defaultCategory:
        typeof obj.defaultCategory === 'string' && obj.defaultCategory.trim().length > 0
          ? obj.defaultCategory.trim().slice(0, 80)
          : 'Tổng hợp',
      enabled: typeof obj.enabled === 'boolean' ? obj.enabled : true,
      addedAt:
        typeof obj.addedAt === 'string' && obj.addedAt.trim().length > 0
          ? obj.addedAt.trim().slice(0, 40)
          : new Date().toISOString(),
      lastFetchedAt: typeof obj.lastFetchedAt === 'string' ? obj.lastFetchedAt : undefined,
      packId: rawPack,
      kind:
        obj.kind === 'googlenews' ||
        obj.kind === 'hackernews' ||
        obj.kind === 'gdelt' ||
        obj.kind === 'api'
          ? obj.kind
          : url.includes('news.google.com')
            ? 'googlenews'
            : url.includes('hacker-news.firebaseio.com')
              ? 'hackernews'
              : 'rss',
      origin:
        obj.origin === 'seed' ||
        obj.origin === 'discovered' ||
        obj.origin === 'watchlist' ||
        obj.origin === 'keyword' ||
        obj.origin === 'custom'
          ? obj.origin
          : safeId.startsWith('seed-')
            ? 'seed'
            : safeId.startsWith('wl-')
              ? 'watchlist'
              : safeId.startsWith('kw-')
                ? 'keyword'
                : 'discovered',
    });
  }
  return out;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function buildDefaultSourcesState(): PersistentSourcesState {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    sources: DEFAULT_SEED_SOURCES.map((s) => ({ ...s })),
    activeTopicPacks: [...DEFAULT_ACTIVE_TOPIC_PACKS],
    customKeywords: [],
    botAutoScanEnabled: true,
    autoFetchInterval: 15,
  };
}

/**
 * Ensures any seed channels missing from a legacy saved list are supplemented cleanly
 * without overriding the enabled/disabled state or deleting custom sources.
 */
export function ensureSeedChannelsPresent(
  existingSources: NewsSourceConfig[],
  enableNewSeeds = true
): NewsSourceConfig[] {
  const existingByUrl = new Map<string, NewsSourceConfig>();
  for (const s of existingSources) {
    existingByUrl.set(canonicalizeSourceUrl(s.url), s);
  }
  const merged = [...existingSources];
  for (const seed of DEFAULT_SEED_SOURCES) {
    const canon = canonicalizeSourceUrl(seed.url);
    if (!existingByUrl.has(canon)) {
      merged.push({ ...seed, enabled: enableNewSeeds });
    } else {
      // Backfill packId / origin metadata if missing from legacy saved source
      const idx = merged.findIndex((x) => canonicalizeSourceUrl(x.url) === canon);
      if (idx !== -1 && !merged[idx].packId) {
        merged[idx] = {
          ...merged[idx],
          packId: seed.packId,
          kind: merged[idx].kind || seed.kind,
          origin: merged[idx].origin || 'seed',
        };
      }
    }
  }
  return merged;
}

export function mergeSourcesStates(
  preferred: PersistentSourcesState,
  secondary: PersistentSourcesState
): PersistentSourcesState {
  const prefTime = new Date(preferred.updatedAt || 0).getTime() || 0;
  const secTime = new Date(secondary.updatedAt || 0).getTime() || 0;
  const newer = prefTime >= secTime ? preferred : secondary;
  const older = prefTime >= secTime ? secondary : preferred;

  const byUrl = new Map<string, NewsSourceConfig>();
  for (const s of older.sources) {
    byUrl.set(canonicalizeSourceUrl(s.url), s);
  }
  for (const s of newer.sources) {
    byUrl.set(canonicalizeSourceUrl(s.url), s);
  }

  const mergedKeywords = Array.from(
    new Set([...newer.customKeywords, ...older.customKeywords].map((k) => k.trim()).filter(Boolean))
  ).slice(0, 20);

  return {
    version: Math.max(newer.version || 1, older.version || 1),
    updatedAt: newer.updatedAt || new Date().toISOString(),
    sources: Array.from(byUrl.values()),
    activeTopicPacks:
      newer.activeTopicPacks.length > 0 || newer !== preferred
        ? newer.activeTopicPacks
        : older.activeTopicPacks,
    customKeywords: mergedKeywords,
    botAutoScanEnabled: newer.botAutoScanEnabled,
    autoFetchInterval: normalizeScanInterval(newer.autoFetchInterval),
  };
}
