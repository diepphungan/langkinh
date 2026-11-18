import type {
  BotAuditEntry,
  DedupBotReport,
  ExistingArticleFingerprint,
} from '../src/types/news.ts';

export function canonicalizeUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl.trim());
    u.hash = '';
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    const stripParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
      'ref',
    ];
    for (const p of stripParams) {
      u.searchParams.delete(p);
    }
    const qs = u.searchParams.toString();
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return `${host}${path}${qs ? `?${qs}` : ''}`;
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

export function normalizeTextForSimilarity(input: string): string {
  return (input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  const norm = normalizeTextForSimilarity(text);
  if (!norm) return [];
  return norm.split(' ').filter((w) => w.length >= 2);
}

export function computeTextSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function extractNumericTokens(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)?/g) || []).filter((n) => n.length >= 1);
}

export function detectContentRevision(
  existing: ExistingArticleFingerprint,
  incomingTitle: string,
  incomingSummaryOrDesc: string
): { hasUpdate: boolean; reason: string } {
  const titleSim = computeTextSimilarity(existing.title, incomingTitle);
  const cleanIncomingSummary = (incomingSummaryOrDesc || '').trim();
  const cleanExistingSummary = (existing.summary || '').trim();

  // Check if headline was substantively revised
  if (titleSim > 0 && titleSim < 0.86) {
    return {
      hasUpdate: true,
      reason: `Phát hiện tiêu đề bài viết có cập nhật mới (tương đồng ${Math.round(titleSim * 100)}%)`,
    };
  }

  // Check if new numeric figures/stats appeared in the updated summary
  const existingNums = new Set(extractNumericTokens(`${existing.title} ${cleanExistingSummary}`));
  const incomingNums = extractNumericTokens(`${incomingTitle} ${cleanIncomingSummary}`);
  const addedNumbers = incomingNums.filter((n) => !existingNums.has(n));
  if (addedNumbers.length > 0 && cleanIncomingSummary.length >= 35) {
    return {
      hasUpdate: true,
      reason: `Phát hiện bổ sung số liệu mới (${addedNumbers.slice(0, 3).join(', ')})`,
    };
  }

  // Check if description/summary expanded meaningfully
  if (cleanIncomingSummary.length >= 50 && cleanExistingSummary.length >= 20) {
    const descSim = computeTextSimilarity(cleanExistingSummary, cleanIncomingSummary);
    if (descSim < 0.65 && cleanIncomingSummary.length > cleanExistingSummary.length * 1.15) {
      return {
        hasUpdate: true,
        reason: `Nội dung tóm tắt được mở rộng hoặc cập nhật mới (khác ${Math.round((1 - descSim) * 100)}%)`,
      };
    }
  } else if (cleanIncomingSummary.length >= 60 && cleanExistingSummary.length < 15) {
    return {
      hasUpdate: true,
      reason: 'Bổ sung phần mô tả nội dung chi tiết mới',
    };
  }

  return {
    hasUpdate: false,
    reason: 'Tin trùng khớp trong kho và nội dung chưa có cập nhật mới',
  };
}

export interface DedupCandidate {
  title: string;
  url: string;
  description: string;
  sourceName: string;
}

export interface DedupCheckedCandidate<T extends DedupCandidate> {
  item: T;
  dedupStatus: 'new' | 'updated';
  existingDocId?: string;
  updateReason?: string;
}

export function evaluateBatchWithDedupBot<T extends DedupCandidate>(
  candidates: T[],
  existingIndex: ExistingArticleFingerprint[]
): {
  accepted: DedupCheckedCandidate<T>[];
  report: DedupBotReport;
} {
  const nowIso = new Date().toISOString();
  const accepted: DedupCheckedCandidate<T>[] = [];
  const decisions: BotAuditEntry[] = [];

  // Map canonical URL -> existing item
  const urlMap = new Map<string, ExistingArticleFingerprint>();
  for (const ex of existingIndex) {
    urlMap.set(canonicalizeUrl(ex.url), ex);
  }

  // Also track accepted URLs/titles within the current batch to prevent intra-batch duplicates
  const seenBatchUrls = new Set<string>();
  const seenBatchTitles: string[] = [];

  let newCount = 0;
  let updatedCount = 0;
  let skippedDuplicateCount = 0;

  for (let idx = 0; idx < candidates.length; idx += 1) {
    const cand = candidates[idx];
    const canonUrl = canonicalizeUrl(cand.url);

    // 1. Check intra-batch duplication first (e.g. multiple RSS feeds from same paper)
    if (seenBatchUrls.has(canonUrl)) {
      skippedDuplicateCount += 1;
      decisions.push({
        id: `bot-${Date.now()}-${idx}`,
        timestamp: nowIso,
        sourceName: cand.sourceName,
        title: cand.title,
        url: cand.url,
        decision: 'skipped_duplicate',
        similarityPercent: 100,
        reason: 'Trùng URL trong cùng lượt quét đa nguồn',
      });
      continue;
    }
    const intraBatchTitleSim = seenBatchTitles.reduce((maxSim, prevTitle) => {
      const s = computeTextSimilarity(prevTitle, cand.title);
      return s > maxSim ? s : maxSim;
    }, 0);
    if (intraBatchTitleSim >= 0.78) {
      skippedDuplicateCount += 1;
      decisions.push({
        id: `bot-${Date.now()}-${idx}`,
        timestamp: nowIso,
        sourceName: cand.sourceName,
        title: cand.title,
        url: cand.url,
        decision: 'skipped_duplicate',
        similarityPercent: Math.round(intraBatchTitleSim * 100),
        reason: `Trùng chủ đề/tiêu đề (${Math.round(intraBatchTitleSim * 100)}%) trong cùng lượt lấy tin`,
      });
      continue;
    }

    // 2. Check against existing database records (URL match first, then content/title similarity)
    let matchedExisting: ExistingArticleFingerprint | undefined = urlMap.get(canonUrl);
    let matchSimilarity = matchedExisting ? 1 : 0;

    if (!matchedExisting) {
      for (const ex of existingIndex) {
        const titleSim = computeTextSimilarity(ex.title, cand.title);
        if (titleSim >= 0.74) {
          matchedExisting = ex;
          matchSimilarity = titleSim;
          break;
        }
      }
    }

    if (!matchedExisting) {
      seenBatchUrls.add(canonUrl);
      seenBatchTitles.push(cand.title);
      newCount += 1;
      accepted.push({
        item: cand,
        dedupStatus: 'new',
      });
      decisions.push({
        id: `bot-${Date.now()}-${idx}`,
        timestamp: nowIso,
        sourceName: cand.sourceName,
        title: cand.title,
        url: cand.url,
        decision: 'new',
        similarityPercent: 0,
        reason: 'Tin mới hoàn toàn — chưa xuất hiện trong Kho Tin',
      });
      continue;
    }

    // 3. Matched existing! Inspect whether content has meaningful updates before skipping
    const revision = detectContentRevision(
      matchedExisting,
      cand.title,
      cand.description
    );

    if (revision.hasUpdate) {
      seenBatchUrls.add(canonUrl);
      seenBatchTitles.push(cand.title);
      updatedCount += 1;
      accepted.push({
        item: cand,
        dedupStatus: 'updated',
        existingDocId: matchedExisting.id,
        updateReason: revision.reason,
      });
      decisions.push({
        id: `bot-${Date.now()}-${idx}`,
        timestamp: nowIso,
        sourceName: cand.sourceName,
        title: cand.title,
        url: cand.url,
        decision: 'updated_content',
        similarityPercent: Math.round(matchSimilarity * 100),
        reason: revision.reason,
        matchedArticleId: matchedExisting.id,
      });
    } else {
      skippedDuplicateCount += 1;
      decisions.push({
        id: `bot-${Date.now()}-${idx}`,
        timestamp: nowIso,
        sourceName: cand.sourceName,
        title: cand.title,
        url: cand.url,
        decision: 'skipped_duplicate',
        similarityPercent: Math.round(matchSimilarity * 100),
        reason: revision.reason,
        matchedArticleId: matchedExisting.id,
      });
    }
  }

  return {
    accepted,
    report: {
      checkedAt: nowIso,
      totalScanned: candidates.length,
      newCount,
      updatedCount,
      skippedDuplicateCount,
      decisions,
    },
  };
}
