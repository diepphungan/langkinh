export interface AutoTagRule {
  id: string;
  tag: string;
  keywords: string[];
  enabled: boolean;
  isCustom?: boolean;
}

export const MAX_TAGS_PER_ARTICLE = 12;
export const MAX_TAG_LENGTH = 40;
const TAG_RULES_STORAGE_KEY = 'lang-kinh-kho-tin-tag-rules-v1';

export const DEFAULT_AUTO_TAG_RULES: AutoTagRule[] = [
  {
    id: 'rule-macro',
    tag: 'Vĩ mô & Chính sách',
    keywords: [
      'lãi suất',
      'lạm phát',
      'gdp',
      'cpi',
      'fdi',
      'chính sách tiền tệ',
      'ngân hàng nhà nước',
      'nhnn',
      'quốc hội',
      'chính phủ',
      'nghị định',
      'đầu tư công',
      'xuất khẩu',
      'nhập khẩu',
    ],
    enabled: true,
  },
  {
    id: 'rule-stocks',
    tag: 'Chứng khoán & VN-Index',
    keywords: [
      'chứng khoán',
      'vn-index',
      'vn30',
      'hnx',
      'upcom',
      'hose',
      'cổ phiếu',
      'khối ngoại',
      'thanh khoản',
      'cổ tức',
      'niêm yết',
      'vốn hóa',
      'đhđcđ',
      'đại hội cổ đông',
    ],
    enabled: true,
  },
  {
    id: 'rule-banking',
    tag: 'Ngân hàng & Tín dụng',
    keywords: [
      'ngân hàng',
      'tín dụng',
      'nợ xấu',
      'trái phiếu',
      'tăng vốn',
      'casa',
      'nim',
      'vietcombank',
      'techcombank',
      'mbbank',
      'bidv',
      'vietinbank',
      'vpbank',
      'sacombank',
      'hdbank',
    ],
    enabled: true,
  },
  {
    id: 'rule-realestate',
    tag: 'Bất động sản & Hạ tầng',
    keywords: [
      'bất động sản',
      'nhà ở',
      'chung cư',
      'đất đai',
      'khu công nghiệp',
      'cao tốc',
      'sân bay',
      'cảng biển',
      'hạ tầng',
      'vinhomes',
      'novaland',
      'đấu giá đất',
    ],
    enabled: true,
  },
  {
    id: 'rule-tech-ai',
    tag: 'Công nghệ & AI',
    keywords: [
      'ai',
      'trí tuệ nhân tạo',
      'chatgpt',
      'gemini',
      'llm',
      'bán dẫn',
      'chip',
      'nvidia',
      'apple',
      'google',
      'microsoft',
      'openai',
      'chuyển đổi số',
      'an ninh mạng',
      'phần mềm',
      'cloud',
    ],
    enabled: true,
  },
  {
    id: 'rule-gold-fx',
    tag: 'Vàng & Tỷ giá',
    keywords: [
      'giá vàng',
      'vàng sjc',
      'vàng nhẫn',
      'tỷ giá',
      'usd/vnd',
      'ngoại hối',
      'fed',
      'lãi suất fed',
      'dự trữ ngoại hối',
    ],
    enabled: true,
  },
  {
    id: 'rule-energy',
    tag: 'Năng lượng & Môi trường',
    keywords: [
      'năng lượng',
      'điện mặt trời',
      'điện gió',
      'lng',
      'giá dầu',
      'xăng dầu',
      'brent',
      'wti',
      'khí hậu',
      'net zero',
      'evn',
      'khí đốt',
    ],
    enabled: true,
  },
  {
    id: 'rule-world',
    tag: 'Quốc tế & Địa chính trị',
    keywords: [
      'mỹ',
      'trung quốc',
      'nga',
      'ukraine',
      'châu âu',
      'eu',
      'israel',
      'trung đông',
      'thuế quan',
      'trừng phạt',
      'brics',
      'nato',
      'biển đông',
    ],
    enabled: true,
  },
  {
    id: 'rule-corporate',
    tag: 'Doanh nghiệp & KQKD',
    keywords: [
      'doanh thu',
      'lợi nhuận',
      'lãi ròng',
      'báo cáo tài chính',
      'trúng thầu',
      'm&a',
      'sáp nhập',
      'nhà máy',
      'kết quả kinh doanh',
    ],
    enabled: true,
  },
  {
    id: 'rule-retail',
    tag: 'Tiêu dùng & Bán lẻ',
    keywords: [
      'bán lẻ',
      'tiêu dùng',
      'thương mại điện tử',
      'sức mua',
      'thế giới di động',
      'bách hóa xanh',
      'fpt retail',
      'masan',
      'vinamilk',
      'du lịch',
      'hàng không',
    ],
    enabled: true,
  },
];

export const KNOWN_VN_TICKERS = [
  'SSI',
  'FPT',
  'VCB',
  'HPG',
  'MWG',
  'TCB',
  'MBB',
  'VPB',
  'ACB',
  'BID',
  'CTG',
  'STB',
  'VNM',
  'VHM',
  'VIC',
  'VRE',
  'MSN',
  'GAS',
  'PLX',
  'POW',
  'GVR',
  'SAB',
  'HDB',
  'TPB',
  'VIB',
  'SSB',
  'SHB',
  'BVH',
  'BCM',
  'VJC',
  'HVN',
  'VND',
  'VCI',
  'HCM',
  'DGC',
  'PNJ',
  'FRT',
  'REE',
  'GMD',
  'KBC',
  'NVL',
  'DIG',
  'DXG',
  'PDR',
  'SHS',
  'PVS',
  'CEO',
  'IDC',
  'ACV',
  'BSR',
  'VEA',
  'VGI',
  'HSG',
  'NKG',
  'DGW',
];

export function sanitizeTagLabel(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_TAG_LENGTH);
}

export function sanitizeTagList(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const item of tags) {
    if (typeof item !== 'string') continue;
    const label = sanitizeTagLabel(item);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(label);
    if (clean.length >= MAX_TAGS_PER_ARTICLE) break;
  }
  return clean;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesKeywordWordBoundary(haystackLower: string, keyword: string): boolean {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return false;
  try {
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(kw)}($|[^\\p{L}\\p{N}])`, 'u');
    return pattern.test(haystackLower);
  } catch {
    return haystackLower.includes(kw);
  }
}

export function extractArticleTags(
  article: {
    title?: string;
    summary?: string;
    keyTakeaway?: string;
    category?: string;
  },
  rules: AutoTagRule[] = loadTagRulesFromStorage()
): string[] {
  const title = article.title || '';
  const summary = article.summary || '';
  const keyTakeaway = article.keyTakeaway || '';
  const combinedRaw = `${title} ${summary} ${keyTakeaway}`;
  const combinedLower = combinedRaw.toLowerCase();

  const matchedTags: string[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const label = sanitizeTagLabel(rule.tag);
    if (!label) continue;
    const hit = rule.keywords.some((kw) => matchesKeywordWordBoundary(combinedLower, kw));
    if (hit) {
      matchedTags.push(label);
    }
  }

  // Match uppercase VN stock tickers (bounded up to 3 tickers to keep tags balanced)
  let tickerHits = 0;
  for (const ticker of KNOWN_VN_TICKERS) {
    if (tickerHits >= 3) break;
    if (new RegExp(`\\b${ticker}\\b`).test(combinedRaw)) {
      matchedTags.push(`Mã: ${ticker}`);
      tickerHits += 1;
    }
  }

  if (matchedTags.length === 0 && article.category) {
    const cat = sanitizeTagLabel(article.category);
    if (cat && cat.toLowerCase() !== 'tổng hợp') {
      matchedTags.push(cat);
    }
  }

  return sanitizeTagList(matchedTags);
}

export function loadTagRulesFromStorage(): AutoTagRule[] {
  if (typeof window === 'undefined') return DEFAULT_AUTO_TAG_RULES;
  try {
    const raw = window.localStorage.getItem(TAG_RULES_STORAGE_KEY);
    if (!raw) return DEFAULT_AUTO_TAG_RULES;
    const parsed = JSON.parse(raw) as AutoTagRule[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_AUTO_TAG_RULES;

    const byId = new Map<string, AutoTagRule>();
    for (const r of parsed) {
      if (r && typeof r.id === 'string' && typeof r.tag === 'string' && Array.isArray(r.keywords)) {
        byId.set(r.id, {
          id: r.id,
          tag: sanitizeTagLabel(r.tag) || 'Nhãn tùy chỉnh',
          keywords: r.keywords.map((k) => String(k).trim().toLowerCase()).filter(Boolean),
          enabled: r.enabled !== false,
          isCustom: Boolean(r.isCustom),
        });
      }
    }

    // Merge defaults (preserving toggle state if user updated a default rule)
    const merged: AutoTagRule[] = DEFAULT_AUTO_TAG_RULES.map((def) => {
      const saved = byId.get(def.id);
      if (saved) {
        byId.delete(def.id);
        return {
          ...def,
          enabled: saved.enabled,
          keywords: saved.keywords.length > 0 ? saved.keywords : def.keywords,
        };
      }
      return def;
    });

    for (const custom of byId.values()) {
      merged.push({ ...custom, isCustom: true });
    }
    return merged;
  } catch {
    return DEFAULT_AUTO_TAG_RULES;
  }
}

export function saveTagRulesToStorage(rules: AutoTagRule[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TAG_RULES_STORAGE_KEY, JSON.stringify(rules));
  } catch {
    // ignore storage quota errors
  }
}
