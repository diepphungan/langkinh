import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  AutomationRule,
  AutomationRulesState,
  AutomationSandboxResult,
  SentimentVerdict,
} from '../src/types/news.ts';
import { BUILTIN_VN_SECURITIES } from './ssiMarketService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const RULES_STORE_PATH = path.join(DATA_DIR, 'automation_rules.json');
const TMP_STORE_PATH = path.join(DATA_DIR, 'automation_rules.json.tmp');

const KNOWN_TICKERS = new Set(BUILTIN_VN_SECURITIES.map((s) => s.symbol));

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractTickersFromText(text: string): string[] {
  const matches = text.match(/\b[A-Z]{3,4}\b/g);
  if (!matches) return [];
  const res = new Set<string>();
  for (const m of matches) {
    if (KNOWN_TICKERS.has(m)) res.add(m);
  }
  return Array.from(res).slice(0, 8);
}

export function inferDeterministicSentiment(text: string): SentimentVerdict {
  const norm = normalizeText(text);
  const negWords = [
    'giam manh',
    'ban thao',
    'thung ho tro',
    'thua lo',
    'no xau',
    'vi pham',
    'khoi to',
    'dinh chi',
    'giam san',
    'ap luc',
    'rui ro cao',
    'sut giam',
    'suy thoai',
    'canh bao',
    'thiet hai',
    'khung hoang',
    'ban rong',
    'giam sau',
  ];
  const posWords = [
    'tang manh',
    'ky luc',
    'vuot dinh',
    'but pha',
    'loi nhuan tang',
    'mua rong',
    'gom hang',
    'ho tro tang',
    'co tuc',
    'tang truong',
    'phuc hoi',
    'tich cuc',
    'ky ket',
    'thong qua',
    'nang hang',
  ];

  let negScore = 0;
  let posScore = 0;
  for (const w of negWords) if (norm.includes(w)) negScore++;
  for (const w of posWords) if (norm.includes(w)) posScore++;

  if (negScore > posScore && negScore >= 1) return 'Tiêu cực';
  if (posScore > negScore && posScore >= 1) return 'Tích cực';
  return 'Trung lập';
}

export function createDefaultAutomationRulesState(): AutomationRulesState {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    stats: {
      totalEvaluated: 0,
      blockedNoiseCount: 0,
      prioritizedCount: 0,
      webhookAlertsTriggered: 0,
    },
    rules: [
      {
        id: 'rule-block-noise',
        name: 'Luật 1 — Chặn nhiễu & Tin quảng cáo / PR',
        conditionSummary:
          'Nếu tiêu đề hoặc tóm tắt chứa từ khóa quảng cáo, giật gân hoặc loại trừ',
        actionSummary: 'Tự động ẩn / bỏ qua trước khi xuất bản lên Bản tin',
        enabled: true,
        conditionType: 'keyword_exclude',
        actionType: 'block_noise',
        keywords: [
          'quảng cáo',
          'tài trợ',
          'bài pr',
          'khuyến mãi sốc',
          'mini game',
          'trúng thưởng',
          'giật gân',
          'tin đồn thất thiệt',
        ],
        hitCount: 0,
        builtin: true,
      },
      {
        id: 'rule-pin-watchlist-macro',
        name: 'Luật 2 — Gắn nhãn Ưu tiên cao (Watchlist & Vĩ mô)',
        conditionSummary:
          'Nếu bài viết chứa mã cổ phiếu Watchlist hoặc từ khóa vĩ mô trọng yếu',
        actionSummary: 'Gắn cờ "Ưu tiên cao" (+22 điểm xếp hạng) & đẩy lên đầu Bản tin',
        enabled: true,
        conditionType: 'watchlist_or_macro',
        actionType: 'pin_priority',
        keywords: [
          'lãi suất',
          'tỷ giá',
          'thuế',
          'đhđcđ',
          'đại hội cổ đông',
          'vn-index',
          'ngân hàng nhà nước',
          'fed',
          'gdp',
          'cổ tức',
        ],
        customTag: 'Ưu tiên cao',
        hitCount: 0,
        builtin: true,
      },
      {
        id: 'rule-alert-negative-watchlist',
        name: 'Luật 3 — Cảnh báo tức thời Telegram / Lark Bot',
        conditionSummary:
          'Nếu phát hiện tin sắc thái Tiêu cực mạnh liên quan tới mã trong Watchlist',
        actionSummary: 'Bắn thông báo khẩn sang Telegram / Lark Bot ngay lập tức',
        enabled: true,
        conditionType: 'negative_watchlist_alert',
        actionType: 'send_webhook_alert',
        keywords: [
          'thủng',
          'giảm mạnh',
          'bán tháo',
          'thua lỗ',
          'vi phạm',
          'cảnh báo',
          'nợ xấu',
          'giảm sàn',
          'rủi ro',
        ],
        sentimentTrigger: 'Tiêu cực',
        hitCount: 0,
        builtin: true,
      },
    ],
  };
}

let cachedState: AutomationRulesState | null = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function saveRulesToDisk(state: AutomationRulesState): AutomationRulesState {
  ensureDir();
  const next: AutomationRulesState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(TMP_STORE_PATH, JSON.stringify(next, null, 2), 'utf8');
  fs.renameSync(TMP_STORE_PATH, RULES_STORE_PATH);
  cachedState = next;
  return next;
}

export function getAutomationRulesState(): AutomationRulesState {
  if (cachedState) return cachedState;
  try {
    ensureDir();
    if (fs.existsSync(RULES_STORE_PATH)) {
      const raw = fs.readFileSync(RULES_STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as AutomationRulesState;
      if (parsed && Array.isArray(parsed.rules) && parsed.rules.length > 0) {
        cachedState = parsed;
        return parsed;
      }
    }
  } catch {
    // fallback to default state
  }
  const initial = createDefaultAutomationRulesState();
  return saveRulesToDisk(initial);
}

export function toggleAutomationRule(ruleId: string): AutomationRulesState {
  const state = getAutomationRulesState();
  const nextRules = state.rules.map((r) =>
    r.id === ruleId ? { ...r, enabled: !r.enabled } : r
  );
  return saveRulesToDisk({ ...state, rules: nextRules });
}

export function updateAutomationRuleKeywords(
  ruleId: string,
  keywords: string[]
): AutomationRulesState {
  const cleanKw = Array.from(
    new Set(
      keywords
        .map((k) => k.trim())
        .filter((k) => k.length >= 2)
        .slice(0, 30)
    )
  );
  const state = getAutomationRulesState();
  const nextRules = state.rules.map((r) =>
    r.id === ruleId ? { ...r, keywords: cleanKw } : r
  );
  return saveRulesToDisk({ ...state, rules: nextRules });
}

export function addCustomAutomationRule(input: {
  name: string;
  conditionType: AutomationRule['conditionType'];
  actionType: AutomationRule['actionType'];
  keywords: string[];
  customTag?: string;
  sentimentTrigger?: SentimentVerdict | 'any';
}): AutomationRulesState {
  const state = getAutomationRulesState();
  const cleanKeywords = Array.from(
    new Set(
      input.keywords
        .map((k) => k.trim())
        .filter((k) => k.length >= 2)
        .slice(0, 20)
    )
  );
  const conditionLabel =
    input.conditionType === 'keyword_exclude'
      ? `Chứa từ khóa loại trừ (${cleanKeywords.slice(0, 3).join(', ')})`
      : input.conditionType === 'negative_watchlist_alert'
        ? `Tin tiêu cực về Watchlist${cleanKeywords.length > 0 ? ` (${cleanKeywords.slice(0, 2).join(', ')})` : ''}`
        : input.conditionType === 'watchlist_or_macro'
          ? `Khớp Watchlist hoặc từ khóa (${cleanKeywords.slice(0, 3).join(', ')})`
          : `Khớp từ khóa "${cleanKeywords.slice(0, 3).join(', ')}"`;

  const actionLabel =
    input.actionType === 'block_noise'
      ? 'Chặn / Ẩn khỏi dòng tin chính'
      : input.actionType === 'pin_priority'
        ? `Gắn cờ "${input.customTag || 'Ưu tiên cao'}" & đẩy lên đầu`
        : input.actionType === 'send_webhook_alert'
          ? 'Gửi cảnh báo Telegram / Lark Bot'
          : `Tự động gắn nhãn "${input.customTag || 'Theo dõi'}"`;

  const newRule: AutomationRule = {
    id: `rule-custom-${Date.now().toString(36)}`,
    name: input.name.trim() || 'Quy tắc tự động mới',
    conditionSummary: conditionLabel,
    actionSummary: actionLabel,
    enabled: true,
    conditionType: input.conditionType,
    actionType: input.actionType,
    keywords: cleanKeywords,
    sentimentTrigger: input.sentimentTrigger || 'any',
    customTag: input.customTag?.trim() || undefined,
    hitCount: 0,
    builtin: false,
  };

  return saveRulesToDisk({
    ...state,
    rules: [...state.rules, newRule],
  });
}

export function deleteCustomAutomationRule(ruleId: string): AutomationRulesState {
  const state = getAutomationRulesState();
  const nextRules = state.rules.filter((r) => r.builtin || r.id !== ruleId);
  return saveRulesToDisk({ ...state, rules: nextRules });
}

export function resetDefaultAutomationRules(): AutomationRulesState {
  const def = createDefaultAutomationRulesState();
  return saveRulesToDisk(def);
}

export interface ArticleRuleEvaluation {
  blocked: boolean;
  blockReason?: string;
  priorityBoost: number;
  priorityBadge?: string;
  autoTags: string[];
  triggerWebhookAlert: boolean;
  matchedTickersForAlert: string[];
  matchedRules: Array<{
    ruleId: string;
    ruleName: string;
    actionType: AutomationRule['actionType'];
    detail: string;
  }>;
}

export function evaluateArticleAgainstRules(
  article: {
    title: string;
    summary: string;
    sentimentLabel: SentimentVerdict;
    matchedTickers: string[];
  },
  watchlistSymbols: string[] = [],
  options?: { recordStats?: boolean }
): ArticleRuleEvaluation {
  const state = getAutomationRulesState();
  const recordStats = options?.recordStats !== false;
  const fullNorm = normalizeText(`${article.title} ${article.summary}`);
  const wlSet = new Set(watchlistSymbols.map((s) => s.trim().toUpperCase()).filter(Boolean));
  const wlMatched = article.matchedTickers.filter((t) => wlSet.has(t.toUpperCase()));

  let blocked = false;
  let blockReason: string | undefined;
  let priorityBoost = 0;
  let priorityBadge: string | undefined;
  let triggerWebhookAlert = false;
  const autoTags = new Set<string>();
  const matchedRules: ArticleRuleEvaluation['matchedRules'] = [];
  const hitRuleIds = new Set<string>();

  for (const rule of state.rules) {
    if (!rule.enabled) continue;
    const matchedKws = rule.keywords.filter((kw) => {
      const n = normalizeText(kw);
      return n.length >= 2 && fullNorm.includes(n);
    });

    if (rule.conditionType === 'keyword_exclude') {
      if (matchedKws.length > 0) {
        blocked = true;
        blockReason = `Chặn bởi "${rule.name}" (khớp từ khóa: ${matchedKws.slice(0, 3).join(', ')})`;
        hitRuleIds.add(rule.id);
        matchedRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          actionType: rule.actionType,
          detail: blockReason,
        });
      }
      continue;
    }

    if (rule.conditionType === 'watchlist_or_macro') {
      if (wlMatched.length > 0 || matchedKws.length > 0) {
        priorityBoost += 22;
        priorityBadge = rule.customTag || 'Ưu tiên cao';
        autoTags.add(priorityBadge);
        hitRuleIds.add(rule.id);
        const reasons: string[] = [];
        if (wlMatched.length > 0) reasons.push(`Watchlist: ${wlMatched.join(', ')}`);
        if (matchedKws.length > 0) reasons.push(`Vĩ mô: ${matchedKws.slice(0, 3).join(', ')}`);
        matchedRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          actionType: rule.actionType,
          detail: `Gắn cờ "${priorityBadge}" (${reasons.join(' · ')})`,
        });
      }
      continue;
    }

    if (rule.conditionType === 'negative_watchlist_alert') {
      const isNegative =
        article.sentimentLabel === 'Tiêu cực' ||
        (rule.sentimentTrigger === 'any' && article.sentimentLabel !== 'Tích cực');
      const tickerMatch = wlMatched.length > 0 || (wlSet.size === 0 && article.matchedTickers.length > 0);
      if (isNegative && tickerMatch) {
        triggerWebhookAlert = true;
        autoTags.add('Cảnh báo Tiêu cực');
        hitRuleIds.add(rule.id);
        const targetSyms = wlMatched.length > 0 ? wlMatched : article.matchedTickers;
        matchedRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          actionType: rule.actionType,
          detail: `Kích hoạt Telegram/Lark Bot cho mã ${targetSyms.join(', ')} (tin Tiêu cực)`,
        });
      }
      continue;
    }

    if (rule.conditionType === 'custom_keyword_tag') {
      const sentimentOk =
        !rule.sentimentTrigger ||
        rule.sentimentTrigger === 'any' ||
        rule.sentimentTrigger === article.sentimentLabel;
      if (sentimentOk && (matchedKws.length > 0 || wlMatched.length > 0)) {
        hitRuleIds.add(rule.id);
        if (rule.actionType === 'block_noise') {
          blocked = true;
          blockReason = `Chặn bởi "${rule.name}"`;
        } else if (rule.actionType === 'pin_priority') {
          priorityBoost += 18;
          priorityBadge = rule.customTag || 'Ưu tiên cao';
          autoTags.add(priorityBadge);
        } else if (rule.actionType === 'send_webhook_alert') {
          triggerWebhookAlert = true;
        } else {
          autoTags.add(rule.customTag || 'Theo dõi');
        }
        matchedRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          actionType: rule.actionType,
          detail: `Khớp từ khóa: ${matchedKws.slice(0, 3).join(', ') || wlMatched.join(', ')}`,
        });
      }
    }
  }

  if (recordStats) {
    const nowIso = new Date().toISOString();
    const updatedRules = state.rules.map((r) =>
      hitRuleIds.has(r.id)
        ? { ...r, hitCount: (r.hitCount || 0) + 1, lastTriggeredAt: nowIso }
        : r
    );
    const nextStats = {
      totalEvaluated: (state.stats.totalEvaluated || 0) + 1,
      blockedNoiseCount: (state.stats.blockedNoiseCount || 0) + (blocked ? 1 : 0),
      prioritizedCount: (state.stats.prioritizedCount || 0) + (!blocked && priorityBoost > 0 ? 1 : 0),
      webhookAlertsTriggered:
        (state.stats.webhookAlertsTriggered || 0) + (!blocked && triggerWebhookAlert ? 1 : 0),
    };
    saveRulesToDisk({
      ...state,
      rules: updatedRules,
      stats: nextStats,
    });
  }

  return {
    blocked,
    blockReason,
    priorityBoost,
    priorityBadge,
    autoTags: Array.from(autoTags),
    triggerWebhookAlert: !blocked && triggerWebhookAlert,
    matchedTickersForAlert: wlMatched.length > 0 ? wlMatched : article.matchedTickers,
    matchedRules,
  };
}

export function runAutomationSandboxTest(params: {
  title: string;
  text: string;
  watchlistSymbols: string[];
}): AutomationSandboxResult {
  const cleanTitle = params.title.trim() || params.text.trim().slice(0, 90) || 'Văn bản kiểm thử';
  const combined = `${cleanTitle} ${params.text}`;
  const sentimentLabel = inferDeterministicSentiment(combined);
  const matchedTickers = extractTickersFromText(combined.toUpperCase());

  const evalRes = evaluateArticleAgainstRules(
    {
      title: cleanTitle,
      summary: params.text,
      sentimentLabel,
      matchedTickers,
    },
    params.watchlistSymbols,
    { recordStats: false }
  );

  let decision: AutomationSandboxResult['decision'] = 'passed';
  let decisionLabel = 'Cho phép xuất bản bình thường lên Bản tin';
  if (evalRes.blocked) {
    decision = 'blocked';
    decisionLabel = 'Đã chặn nhiễu — Không hiển thị lên Bản tin chính';
  } else if (evalRes.triggerWebhookAlert) {
    decision = 'alerted';
    decisionLabel = 'Gắn Ưu tiên + Bắn cảnh báo khẩn sang Telegram / Lark Bot';
  } else if (evalRes.priorityBoost > 0) {
    decision = 'prioritized';
    decisionLabel = 'Gắn cờ "Ưu tiên cao" & Đẩy lên top Bản tin';
  }

  const baseScore = 58 + (matchedTickers.length > 0 ? 8 : 0) + evalRes.priorityBoost;

  return {
    inputTitle: cleanTitle,
    sentimentLabel,
    matchedTickers,
    decision,
    decisionLabel,
    matchedRules: evalRes.matchedRules,
    resultingTags: evalRes.autoTags,
    priorityScore: evalRes.blocked ? 0 : Math.min(99, baseScore),
  };
}
