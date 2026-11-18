import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type {
  EditionRankedStory,
  EditionType,
  FetchedSourceArticle,
  FinanceAlertItem,
  FinanceAlertSeverity,
  FinanceAlertTriggerType,
  MarketExchange,
  NewsroomEdition,
  NewsSensitivity,
  NewsSourceConfig,
  PersistentSourcesState,
  SentimentVerdict,
  StoredArticleStatus,
  StoredNewsArticle,
  TopicPackId,
  WatchlistItemConfig,
} from '../types/news';
import {
  normalizeNewsSourceList,
  normalizeScanInterval,
  normalizeTopicPackIds,
} from './defaultSeedSources';
import { extractArticleTags, sanitizeTagList } from './articleAutoTagger';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function makeSafeArticleDocId(url: string): string {
  // FNV-1a 64-bit style dual-hash for deterministic, rule-safe IDs matching ^[a-zA-Z0-9_-]+$
  let h1 = 2166136261;
  let h2 = 33554467;
  for (let i = 0; i < url.length; i += 1) {
    const c = url.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 16777619);
    h2 ^= c + i;
    h2 = Math.imul(h2, 16777619);
  }
  const id = `art_${(h1 >>> 0).toString(36)}_${(h2 >>> 0).toString(36)}`;
  return id.slice(0, 120);
}

function clampScore(n: number): number {
  const v = Math.round(Number(n) || 0);
  return Math.max(0, Math.min(100, v));
}

function cleanStr(val: string | undefined, fallback: string, maxLen: number): string {
  const trimmed = (val || '').trim();
  const s = trimmed.length > 0 ? trimmed : fallback;
  return s.slice(0, maxLen);
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\/.+/i.test(trimmed)) {
    return trimmed.slice(0, 1000);
  }
  return `https://${trimmed}`.slice(0, 1000);
}

function normalizeSentimentVerdict(val: string): SentimentVerdict {
  if (val === 'Tích cực' || val === 'Tiêu cực' || val === 'Trung lập') return val;
  return 'Trung lập';
}

function timestampToIso(raw: unknown): string {
  if (raw && typeof (raw as Timestamp).toDate === 'function') {
    return (raw as Timestamp).toDate().toISOString();
  }
  if (typeof raw === 'string' && raw.length > 0) return raw;
  return new Date().toISOString();
}

export function mapFetchedToStoredPayload(
  userId: string,
  article: FetchedSourceArticle,
  fetchedMethod: string
): Omit<StoredNewsArticle, 'id' | 'createdAt' | 'updatedAt' | 'syncedToCloud'> {
  return {
    ownerId: userId.slice(0, 128),
    title: cleanStr(article.title, 'Bài viết tin tức', 300),
    url: normalizeUrl(article.url),
    sourceName: cleanStr(article.sourceName, 'Nguồn tin', 120),
    sourceDomain: cleanStr(article.sourceDomain, 'news.source', 120),
    category: cleanStr(article.category, 'Tổng hợp', 80),
    publishedRelative: cleanStr(article.publishedRelative, 'Mới cập nhật', 80),
    summary: cleanStr(article.summary, '', 1500),
    keyTakeaway: cleanStr(article.keyTakeaway, '', 600),
    sentimentLabel: normalizeSentimentVerdict(article.sentimentLabel),
    sentimentPositive: clampScore(article.sentiment.positive),
    sentimentNeutral: clampScore(article.sentiment.neutral),
    sentimentNegative: clampScore(article.sentiment.negative),
    fetchedMethod: cleanStr(fetchedMethod, 'RSS/Atom', 40),
    notes: '',
    tags: extractArticleTags({
      title: article.title,
      summary: article.summary,
      keyTakeaway: article.keyTakeaway,
      category: article.category,
    }),
    status: 'unread',
  };
}

export function subscribeFetchedArticles(
  userId: string,
  onData: (articles: StoredNewsArticle[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = `users/${userId}/fetchedArticles`;
  const q = query(
    collection(db, path),
    where('ownerId', '==', userId),
    limit(200)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: StoredNewsArticle[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          ownerId: String(d.ownerId || userId),
          title: String(d.title || ''),
          url: String(d.url || ''),
          sourceName: String(d.sourceName || ''),
          sourceDomain: String(d.sourceDomain || ''),
          category: String(d.category || 'Tổng hợp'),
          publishedRelative: String(d.publishedRelative || ''),
          summary: String(d.summary || ''),
          keyTakeaway: String(d.keyTakeaway || ''),
          sentimentLabel: normalizeSentimentVerdict(String(d.sentimentLabel || '')),
          sentimentPositive: clampScore(Number(d.sentimentPositive ?? 33)),
          sentimentNeutral: clampScore(Number(d.sentimentNeutral ?? 34)),
          sentimentNegative: clampScore(Number(d.sentimentNegative ?? 33)),
          fetchedMethod: String(d.fetchedMethod || 'RSS/Atom'),
          notes: String(d.notes || ''),
          tags: Array.isArray(d.tags)
            ? sanitizeTagList(d.tags)
            : extractArticleTags({
                title: String(d.title || ''),
                summary: String(d.summary || ''),
                keyTakeaway: String(d.keyTakeaway || ''),
                category: String(d.category || ''),
              }),
          status: (d.status as StoredArticleStatus) || 'unread',
          createdAt: timestampToIso(d.createdAt),
          updatedAt: timestampToIso(d.updatedAt),
          syncedToCloud: true,
        };
      });

      list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function upsertFetchedArticlesToFirestore(
  userId: string,
  items: Array<{ article: FetchedSourceArticle; method: string }>
): Promise<{ savedCount: number; updatedCount: number }> {
  let savedCount = 0;
  let updatedCount = 0;

  for (const item of items) {
    if (!item.article.url || !/^https?:\/\//i.test(item.article.url)) continue;

    const candidateId =
      item.article.dedupStatus === 'updated' &&
      item.article.existingDocId &&
      /^[a-zA-Z0-9_-]{1,128}$/.test(item.article.existingDocId)
        ? item.article.existingDocId
        : makeSafeArticleDocId(item.article.url);

    const docPath = `users/${userId}/fetchedArticles/${candidateId}`;
    const ref = doc(db, docPath);

    try {
      const existingSnap = await getDoc(ref);
      if (existingSnap.exists()) {
        const existingData = existingSnap.data();
        if (
          item.article.dedupStatus === 'updated' &&
          existingData.status !== 'archived'
        ) {
          const prevNote = String(existingData.notes || '').trim();
          const updateBadge = item.article.updateReason
            ? `[Bot cập nhật] ${item.article.updateReason}`
            : '[Bot cập nhật] Phát hiện sửa đổi nội dung mới';
          const nextNotes = prevNote.includes(updateBadge)
            ? prevNote
            : [updateBadge, prevNote].filter(Boolean).join(' · ').slice(0, 1000);

          const existingTags = Array.isArray(existingData.tags)
            ? sanitizeTagList(existingData.tags)
            : [];
          const autoTags = extractArticleTags({
            title: item.article.title,
            summary: item.article.summary,
            keyTakeaway: item.article.keyTakeaway,
            category: item.article.category,
          });
          const mergedTags = sanitizeTagList([...existingTags, ...autoTags]);

          await updateDoc(ref, {
            title: cleanStr(item.article.title, 'Bài viết tin tức', 300),
            summary: cleanStr(item.article.summary, '', 1500),
            keyTakeaway: cleanStr(item.article.keyTakeaway, '', 600),
            category: cleanStr(item.article.category, 'Tổng hợp', 80),
            sentimentLabel: normalizeSentimentVerdict(item.article.sentimentLabel),
            sentimentPositive: clampScore(item.article.sentiment.positive),
            sentimentNeutral: clampScore(item.article.sentiment.neutral),
            sentimentNegative: clampScore(item.article.sentiment.negative),
            notes: nextNotes,
            tags: mergedTags,
            updatedAt: serverTimestamp(),
          });
          updatedCount += 1;
        }
        continue;
      }

      const fallbackRef =
        candidateId !== makeSafeArticleDocId(item.article.url)
          ? doc(db, `users/${userId}/fetchedArticles/${makeSafeArticleDocId(item.article.url)}`)
          : ref;

      if (fallbackRef !== ref) {
        const fallbackSnap = await getDoc(fallbackRef);
        if (fallbackSnap.exists()) {
          continue;
        }
      }

      const payload = mapFetchedToStoredPayload(userId, item.article, item.method);
      await setDoc(fallbackRef, {
        ...payload,
        notes:
          item.article.dedupStatus === 'updated' && item.article.updateReason
            ? `[Bot cập nhật] ${item.article.updateReason}`.slice(0, 1000)
            : '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      savedCount += 1;
    } catch (error) {
      handleFirestoreError(
        error,
        item.article.dedupStatus === 'updated' ? OperationType.UPDATE : OperationType.CREATE,
        docPath
      );
    }
  }

  return { savedCount, updatedCount };
}

export async function saveArticlesToFirestore(
  userId: string,
  items: Array<{ article: FetchedSourceArticle; method: string }>
): Promise<number> {
  const { savedCount, updatedCount } = await upsertFetchedArticlesToFirestore(userId, items);
  return savedCount + updatedCount;
}

export async function saveStoredArticlesBatchToFirestore(
  userId: string,
  articles: StoredNewsArticle[]
): Promise<number> {
  let savedCount = 0;
  for (const art of articles) {
    if (!art.url || !/^https?:\/\//i.test(art.url)) continue;
    const docId = makeSafeArticleDocId(art.url);
    const docPath = `users/${userId}/fetchedArticles/${docId}`;
    const ref = doc(db, docPath);

    try {
      const existingSnap = await getDoc(ref);
      if (existingSnap.exists()) continue;
      await setDoc(ref, {
        ownerId: userId.slice(0, 128),
        title: cleanStr(art.title, 'Bài viết tin tức', 300),
        url: normalizeUrl(art.url),
        sourceName: cleanStr(art.sourceName, 'Nguồn tin', 120),
        sourceDomain: cleanStr(art.sourceDomain, 'news.source', 120),
        category: cleanStr(art.category, 'Tổng hợp', 80),
        publishedRelative: cleanStr(art.publishedRelative, 'Mới cập nhật', 80),
        summary: cleanStr(art.summary, '', 1500),
        keyTakeaway: cleanStr(art.keyTakeaway, '', 600),
        sentimentLabel: normalizeSentimentVerdict(art.sentimentLabel),
        sentimentPositive: clampScore(art.sentimentPositive),
        sentimentNeutral: clampScore(art.sentimentNeutral),
        sentimentNegative: clampScore(art.sentimentNegative),
        fetchedMethod: cleanStr(art.fetchedMethod, 'RSS/Atom', 40),
        notes: cleanStr(art.notes, '', 1000),
        tags:
          Array.isArray(art.tags) && art.tags.length > 0
            ? sanitizeTagList(art.tags)
            : extractArticleTags({
                title: art.title,
                summary: art.summary,
                keyTakeaway: art.keyTakeaway,
                category: art.category,
              }),
        status:
          art.status === 'reviewed' || art.status === 'archived' ? art.status : 'unread',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      savedCount += 1;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, docPath);
    }
  }
  return savedCount;
}

export async function updateArticleInFirestore(
  userId: string,
  articleId: string,
  patch: { status?: StoredArticleStatus; notes?: string; tags?: string[] }
): Promise<void> {
  const docPath = `users/${userId}/fetchedArticles/${articleId}`;
  const ref = doc(db, docPath);
  const updatePayload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (patch.status) {
    updatePayload.status = patch.status;
  }
  if (typeof patch.notes === 'string') {
    updatePayload.notes = patch.notes.slice(0, 1000);
  }
  if (Array.isArray(patch.tags)) {
    updatePayload.tags = sanitizeTagList(patch.tags);
  }
  try {
    await updateDoc(ref, updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function batchUpdateArticleTagsInFirestore(
  userId: string,
  updates: Array<{ id: string; tags: string[] }>
): Promise<number> {
  let updatedCount = 0;
  for (const u of updates) {
    if (!u.id || !/^[a-zA-Z0-9_-]{1,128}$/.test(u.id)) continue;
    const docPath = `users/${userId}/fetchedArticles/${u.id}`;
    const ref = doc(db, docPath);
    try {
      await updateDoc(ref, {
        tags: sanitizeTagList(u.tags),
        updatedAt: serverTimestamp(),
      });
      updatedCount += 1;
    } catch {
      // Skip archived or missing items gracefully during bulk auto-tagging
    }
  }
  return updatedCount;
}

export async function deleteArticleFromFirestore(
  userId: string,
  articleId: string
): Promise<void> {
  const docPath = `users/${userId}/fetchedArticles/${articleId}`;
  const ref = doc(db, docPath);
  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

/* --- Watchlist & Finance Alerts Firestore Sync --- */

function normalizeSafeDocId(raw: string): string {
  const clean = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return clean || `id_${Date.now()}`;
}

export function subscribeWatchlistItems(
  userId: string,
  onData: (items: WatchlistItemConfig[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = `users/${userId}/watchlistItems`;
  const q = query(collection(db, path), where('ownerId', '==', userId), limit(60));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: WatchlistItemConfig[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const ex = String(d.exchange || 'HOSE');
        const sens = String(d.newsSensitivity || 'all');
        return {
          symbol: String(d.symbol || docSnap.id).toUpperCase(),
          exchange: (ex === 'HNX' || ex === 'UPCOM' ? ex : 'HOSE') as MarketExchange,
          companyName: String(d.companyName || docSnap.id),
          priceChangeThresholdPct: Number(d.priceChangeThresholdPct ?? 3),
          targetPrice: Number(d.targetPrice ?? 0),
          stopLossPrice: Number(d.stopLossPrice ?? 0),
          newsSensitivity: (
            sens === 'bearish' || sens === 'bullish' ? sens : 'all'
          ) as NewsSensitivity,
          notes: String(d.notes || ''),
          createdAt: timestampToIso(d.createdAt),
          updatedAt: timestampToIso(d.updatedAt),
          syncedToCloud: true,
        };
      });
      list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function upsertWatchlistItemToFirestore(
  userId: string,
  item: WatchlistItemConfig
): Promise<void> {
  const symbol = item.symbol
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
  if (!symbol || !/^[A-Z0-9]{1,12}$/.test(symbol)) {
    throw new Error('Mã cổ phiếu không hợp lệ (chỉ gồm chữ cái và số, tối đa 12 ký tự).');
  }
  const docPath = `users/${userId}/watchlistItems/${symbol}`;
  const ref = doc(db, docPath);

  const exchange: MarketExchange =
    item.exchange === 'HNX' || item.exchange === 'UPCOM' ? item.exchange : 'HOSE';
  const newsSensitivity: NewsSensitivity =
    item.newsSensitivity === 'bearish' || item.newsSensitivity === 'bullish'
      ? item.newsSensitivity
      : 'all';
  const threshold = Math.max(0.5, Math.min(50, Number(item.priceChangeThresholdPct) || 3));
  const targetPrice = Math.max(0, Math.min(10000000, Number(item.targetPrice) || 0));
  const stopLossPrice = Math.max(0, Math.min(10000000, Number(item.stopLossPrice) || 0));

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      await updateDoc(ref, {
        exchange,
        companyName: cleanStr(item.companyName, symbol, 120),
        priceChangeThresholdPct: threshold,
        targetPrice,
        stopLossPrice,
        newsSensitivity,
        notes: (item.notes || '').slice(0, 400),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ownerId: userId.slice(0, 128),
        symbol,
        exchange,
        companyName: cleanStr(item.companyName, symbol, 120),
        priceChangeThresholdPct: threshold,
        targetPrice,
        stopLossPrice,
        newsSensitivity,
        notes: (item.notes || '').slice(0, 400),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function saveWatchlistBatchToFirestore(
  userId: string,
  items: WatchlistItemConfig[]
): Promise<number> {
  let savedCount = 0;
  for (const item of items.slice(0, 30)) {
    const cleanSym = item.symbol
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 12);
    if (!cleanSym) continue;
    await upsertWatchlistItemToFirestore(userId, { ...item, symbol: cleanSym });
    savedCount += 1;
  }
  return savedCount;
}

export async function deleteWatchlistItemFromFirestore(
  userId: string,
  symbol: string
): Promise<void> {
  const safeSym = symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (!safeSym) return;
  const docPath = `users/${userId}/watchlistItems/${safeSym}`;
  const ref = doc(db, docPath);
  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export function subscribeFinanceAlerts(
  userId: string,
  onData: (alerts: FinanceAlertItem[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = `users/${userId}/financeAlerts`;
  const q = query(collection(db, path), where('ownerId', '==', userId), limit(100));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: FinanceAlertItem[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const sev = String(d.severity || 'warning');
        return {
          id: docSnap.id,
          symbol: String(d.symbol || ''),
          severity: (
            sev === 'critical' || sev === 'opportunity' ? sev : 'warning'
          ) as FinanceAlertSeverity,
          title: String(d.title || ''),
          message: String(d.message || ''),
          triggerType: String(d.triggerType || 'news_any') as FinanceAlertTriggerType,
          articleUrl: String(d.articleUrl || ''),
          priceSnapshot: Number(d.priceSnapshot ?? 0),
          changePctSnapshot: Number(d.changePctSnapshot ?? 0),
          read: Boolean(d.read),
          createdAt: timestampToIso(d.createdAt),
          updatedAt: timestampToIso(d.updatedAt),
        };
      });
      list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function saveFinanceAlertsToFirestore(
  userId: string,
  alerts: FinanceAlertItem[]
): Promise<void> {
  for (const al of alerts.slice(0, 25)) {
    const safeId = normalizeSafeDocId(al.id);
    const docPath = `users/${userId}/financeAlerts/${safeId}`;
    const ref = doc(db, docPath);
    try {
      const existingSnap = await getDoc(ref);
      if (existingSnap.exists()) continue;

      const changePct = Math.max(-100, Math.min(100, Number(al.changePctSnapshot) || 0));
      const price = Math.max(0, Number(al.priceSnapshot) || 0);

      await setDoc(ref, {
        ownerId: userId.slice(0, 128),
        symbol: cleanStr(al.symbol.toUpperCase(), 'VN', 12),
        severity:
          al.severity === 'critical' || al.severity === 'opportunity'
            ? al.severity
            : 'warning',
        title: cleanStr(al.title, 'Cảnh báo cổ phiếu', 240),
        message: (al.message || '').slice(0, 800),
        triggerType: cleanStr(al.triggerType, 'news_any', 40),
        articleUrl: (al.articleUrl || '').slice(0, 1000),
        priceSnapshot: price,
        changePctSnapshot: changePct,
        read: Boolean(al.read),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, docPath);
    }
  }
}

export async function markFinanceAlertReadInFirestore(
  userId: string,
  alertId: string,
  read = true
): Promise<void> {
  const safeId = normalizeSafeDocId(alertId);
  const docPath = `users/${userId}/financeAlerts/${safeId}`;
  const ref = doc(db, docPath);
  try {
    await updateDoc(ref, {
      read,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function deleteFinanceAlertFromFirestore(
  userId: string,
  alertId: string
): Promise<void> {
  const safeId = normalizeSafeDocId(alertId);
  const docPath = `users/${userId}/financeAlerts/${safeId}`;
  const ref = doc(db, docPath);
  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

/* --- Newsroom Morning & Afternoon Editions Firestore Sync --- */

export function subscribeNewsroomEditions(
  userId: string,
  onData: (editions: NewsroomEdition[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = `users/${userId}/newsroomEditions`;
  const q = query(collection(db, path), where('ownerId', '==', userId), limit(60));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: NewsroomEdition[] = [];
      for (const docSnap of snapshot.docs) {
        try {
          const d = docSnap.data();
          const highlights = JSON.parse(String(d.executiveHighlightsJson || '[]')) as string[];
          const quickMetrics = JSON.parse(
            String(
              d.quickMetricsJson ||
                '{"vnIndexText":"Chưa có dữ liệu","watchlistHighlight":"Chưa có Watchlist","topSocialTrend":"Đang cập nhật"}'
            )
          ) as NewsroomEdition['quickMetrics'];
          const stories = JSON.parse(String(d.storiesJson || '[]')) as EditionRankedStory[];
          const edType: EditionType = d.editionType === 'afternoon' ? 'afternoon' : 'morning';
          list.push({
            editionKey: String(d.editionKey || docSnap.id),
            dateStr: String(d.dateStr || ''),
            editionType: edType,
            editionLabel: String(d.editionLabel || ''),
            windowLabel: String(d.windowLabel || ''),
            generatedAt: timestampToIso(d.updatedAt || d.createdAt),
            mode: d.mode === 'gemini' ? 'gemini' : 'quantitative',
            executiveHighlights: Array.isArray(highlights) ? highlights : [],
            quickMetrics,
            stories: Array.isArray(stories) ? stories : [],
            totalCandidatesReviewed: Number(d.totalCandidatesReviewed ?? 0),
            sentTelegramAt: null,
            sentLarkAt: null,
            syncedToCloud: true,
          });
        } catch {
          // ignore malformed edition snapshot
        }
      }
      list.sort(
        (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
      );
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function saveNewsroomEditionToFirestore(
  userId: string,
  edition: NewsroomEdition
): Promise<void> {
  const safeKey = edition.editionKey
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40);
  if (!safeKey) return;
  const docPath = `users/${userId}/newsroomEditions/${safeKey}`;
  const ref = doc(db, docPath);

  const compactStories = edition.stories.slice(0, 10).map((s) => ({
    ...s,
    title: cleanStr(s.title, 'Tin tức', 200),
    oneLineSummary: cleanStr(s.oneLineSummary, '', 260),
    url: (s.url || '').slice(0, 500),
    sourceName: cleanStr(s.sourceName, 'Nguồn tin', 80),
  }));

  const highlightsJson = JSON.stringify(edition.executiveHighlights.slice(0, 4)).slice(0, 2000);
  const quickMetricsJson = JSON.stringify(edition.quickMetrics).slice(0, 1200);
  const storiesJson = JSON.stringify(compactStories).slice(0, 16000);

  const payload = {
    editionLabel: cleanStr(edition.editionLabel, 'Ấn bản Lăng Kính', 120),
    windowLabel: cleanStr(edition.windowLabel, '', 160),
    mode: edition.mode === 'gemini' ? 'gemini' : 'quantitative',
    executiveHighlightsJson: highlightsJson,
    quickMetricsJson,
    storiesJson,
    totalCandidatesReviewed: Math.max(
      0,
      Math.min(5000, Math.round(Number(edition.totalCandidatesReviewed) || 0))
    ),
    updatedAt: serverTimestamp(),
  };

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, {
        ownerId: userId.slice(0, 128),
        editionKey: safeKey,
        dateStr: cleanStr(edition.dateStr, new Date().toISOString().slice(0, 10), 10),
        editionType: edition.editionType === 'afternoon' ? 'afternoon' : 'morning',
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

/* --- User News Sources Cloud Sync (Layer 3: user_news_sources) --- */

export interface CloudUserNewsSourcesSnapshot {
  hasRemoteConfig: boolean;
  state: PersistentSourcesState;
}

const cloudSourceKnownIds = new Map<string, Set<string>>();
const cloudSourceSignatures = new Map<string, Map<string, string>>();
const cloudConfigSignatures = new Map<string, string>();

function makeSourceSignature(src: NewsSourceConfig): string {
  return JSON.stringify([
    src.name,
    src.url,
    src.domain,
    src.defaultCategory,
    src.packId || '',
    src.kind || 'rss',
    src.origin || 'seed',
    Boolean(src.enabled),
  ]);
}

function makeConfigSignature(state: PersistentSourcesState): string {
  return JSON.stringify([
    state.activeTopicPacks,
    state.customKeywords,
    Boolean(state.botAutoScanEnabled),
    normalizeScanInterval(state.autoFetchInterval),
    state.sources.length,
  ]);
}

export function subscribeUserNewsSources(
  userId: string,
  onData: (snapshot: CloudUserNewsSourcesSnapshot) => void,
  onError: (err: Error) => void
): () => void {
  const configPath = `user_news_sources/${userId}`;
  const itemsPath = `user_news_sources/${userId}/sources`;
  const configRef = doc(db, configPath);
  const itemsQuery = query(
    collection(db, itemsPath),
    where('ownerId', '==', userId),
    limit(250)
  );

  let configReady = false;
  let itemsReady = false;
  let hasRemoteConfig = false;
  let remoteConfig: Omit<PersistentSourcesState, 'sources'> = {
    version: 1,
    updatedAt: '',
    activeTopicPacks: [],
    customKeywords: [],
    botAutoScanEnabled: true,
    autoFetchInterval: 15,
  };
  let remoteSources: NewsSourceConfig[] = [];

  const emitIfReady = () => {
    if (!configReady || !itemsReady) return;
    onData({
      hasRemoteConfig: hasRemoteConfig || remoteSources.length > 0,
      state: {
        ...remoteConfig,
        sources: remoteSources,
      },
    });
  };

  const unsubConfig = onSnapshot(
    configRef,
    (snap) => {
      configReady = true;
      if (snap.exists()) {
        hasRemoteConfig = true;
        const d = snap.data();
        remoteConfig = {
          version: 1,
          updatedAt:
            typeof d.clientUpdatedAt === 'string' && d.clientUpdatedAt.length > 0
              ? d.clientUpdatedAt
              : timestampToIso(d.updatedAt),
          activeTopicPacks: normalizeTopicPackIds(d.activeTopicPacks),
          customKeywords: Array.isArray(d.customKeywords)
            ? d.customKeywords
                .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
                .slice(0, 24)
            : [],
          botAutoScanEnabled:
            typeof d.botAutoScanEnabled === 'boolean' ? d.botAutoScanEnabled : true,
          autoFetchInterval: normalizeScanInterval(d.autoFetchInterval),
        };
      } else {
        hasRemoteConfig = false;
      }
      emitIfReady();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, configPath);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  const unsubItems = onSnapshot(
    itemsQuery,
    (snapshot) => {
      itemsReady = true;
      const known = new Set<string>();
      const sigs = new Map<string, string>();
      const rawItems = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        known.add(docSnap.id);
        const mapped: NewsSourceConfig = {
          id: String(d.sourceId || docSnap.id),
          name: String(d.name || ''),
          url: String(d.url || ''),
          domain: String(d.domain || ''),
          defaultCategory: String(d.defaultCategory || 'Tổng hợp'),
          packId:
            typeof d.packId === 'string' && d.packId.trim().length > 0
              ? (d.packId as TopicPackId)
              : undefined,
          kind:
            d.kind === 'googlenews' ||
            d.kind === 'hackernews' ||
            d.kind === 'gdelt' ||
            d.kind === 'api'
              ? d.kind
              : 'rss',
          origin:
            d.origin === 'discovered' ||
            d.origin === 'watchlist' ||
            d.origin === 'keyword' ||
            d.origin === 'custom'
              ? d.origin
              : 'seed',
          enabled: typeof d.enabled === 'boolean' ? d.enabled : true,
          addedAt:
            typeof d.addedAt === 'string' && d.addedAt.length > 0
              ? d.addedAt
              : timestampToIso(d.createdAt),
        };
        sigs.set(docSnap.id, makeSourceSignature(mapped));
        return mapped;
      });
      cloudSourceKnownIds.set(userId, known);
      cloudSourceSignatures.set(userId, sigs);
      remoteSources = normalizeNewsSourceList(rawItems);
      emitIfReady();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, itemsPath);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  return () => {
    unsubConfig();
    unsubItems();
  };
}

export async function syncUserNewsSourcesToFirestore(
  userId: string,
  state: PersistentSourcesState
): Promise<void> {
  const configPath = `user_news_sources/${userId}`;
  const configRef = doc(db, configPath);

  const boundedPacks = normalizeTopicPackIds(state.activeTopicPacks)
    .map((p) => p.slice(0, 40))
    .slice(0, 12);
  const boundedKeywords = Array.from(
    new Set(state.customKeywords.map((k) => k.trim().slice(0, 80)).filter(Boolean))
  ).slice(0, 24);
  const boundedSources = state.sources
    .filter((s) => s.url && /^https?:\/\/.+/i.test(s.url))
    .slice(0, 200);
  const interval = normalizeScanInterval(state.autoFetchInterval);
  const clientUpdatedAt = cleanStr(state.updatedAt, new Date().toISOString(), 40);

  const cfgSig = makeConfigSignature(state);
  const shouldWriteConfig = cloudConfigSignatures.get(userId) !== cfgSig;

  try {
    if (shouldWriteConfig) {
      const existingConfigSnap = await getDoc(configRef);
      if (existingConfigSnap.exists()) {
        await setDoc(
          configRef,
          {
            activeTopicPacks: boundedPacks,
            customKeywords: boundedKeywords,
            botAutoScanEnabled: Boolean(state.botAutoScanEnabled),
            autoFetchInterval: interval,
            sourcesCount: boundedSources.length,
            clientUpdatedAt,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        await setDoc(
          configRef,
          {
            ownerId: userId.slice(0, 128),
            activeTopicPacks: boundedPacks,
            customKeywords: boundedKeywords,
            botAutoScanEnabled: Boolean(state.botAutoScanEnabled),
            autoFetchInterval: interval,
            sourcesCount: boundedSources.length,
            clientUpdatedAt,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
      cloudConfigSignatures.set(userId, cfgSig);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, configPath);
  }

  let knownIds = cloudSourceKnownIds.get(userId);
  if (!knownIds) {
    knownIds = new Set<string>();
    cloudSourceKnownIds.set(userId, knownIds);
  }
  let sigMap = cloudSourceSignatures.get(userId);
  if (!sigMap) {
    sigMap = new Map<string, string>();
    cloudSourceSignatures.set(userId, sigMap);
  }

  const activeSafeIds = new Set<string>();
  const pendingWrites: Array<{ safeId: string; src: NewsSourceConfig; sig: string }> = [];

  for (const src of boundedSources) {
    const safeId = normalizeSafeDocId(src.id);
    activeSafeIds.add(safeId);
    const sig = makeSourceSignature(src);
    if (sigMap.get(safeId) === sig) continue;
    pendingWrites.push({ safeId, src, sig });
  }

  const WRITE_BATCH = 10;
  for (let i = 0; i < pendingWrites.length; i += WRITE_BATCH) {
    const chunk = pendingWrites.slice(i, i + WRITE_BATCH);
    await Promise.all(
      chunk.map(async ({ safeId, src, sig }) => {
        const itemPath = `user_news_sources/${userId}/sources/${safeId}`;
        const itemRef = doc(db, itemPath);
        const updatableFields = {
          name: cleanStr(src.name, src.domain || 'Nguồn tin', 160),
          url: normalizeUrl(src.url),
          domain: cleanStr(src.domain, 'news.source', 120),
          defaultCategory: cleanStr(src.defaultCategory, 'Tổng hợp', 80),
          packId: (src.packId || '').slice(0, 40),
          kind:
            src.kind === 'googlenews' ||
            src.kind === 'hackernews' ||
            src.kind === 'gdelt' ||
            src.kind === 'api'
              ? src.kind
              : 'rss',
          origin:
            src.origin === 'discovered' ||
            src.origin === 'watchlist' ||
            src.origin === 'keyword' ||
            src.origin === 'custom'
              ? src.origin
              : 'seed',
          enabled: Boolean(src.enabled),
          updatedAt: serverTimestamp(),
        };

        try {
          let existsOnServer = knownIds!.has(safeId);
          if (!existsOnServer) {
            const snap = await getDoc(itemRef);
            existsOnServer = snap.exists();
            if (existsOnServer) knownIds!.add(safeId);
          }

          if (existsOnServer) {
            await setDoc(itemRef, updatableFields, { merge: true });
          } else {
            await setDoc(
              itemRef,
              {
                ownerId: userId.slice(0, 128),
                sourceId: safeId,
                ...updatableFields,
                addedAt: cleanStr(src.addedAt, new Date().toISOString(), 40),
                createdAt: serverTimestamp(),
              },
              { merge: true }
            );
            knownIds!.add(safeId);
          }
          sigMap!.set(safeId, sig);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, itemPath);
        }
      })
    );
  }

  // Delete sources that were removed by user
  const deletedIds = Array.from(knownIds).filter((id) => !activeSafeIds.has(id));
  for (const delId of deletedIds) {
    const itemPath = `user_news_sources/${userId}/sources/${delId}`;
    try {
      await deleteDoc(doc(db, itemPath));
      knownIds.delete(delId);
      sigMap.delete(delId);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, itemPath);
    }
  }
}

