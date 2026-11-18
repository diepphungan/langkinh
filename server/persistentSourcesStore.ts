import fs from 'fs';
import path from 'path';
import type {
  NewsSourceConfig,
  PersistentSourcesState,
  TopicPackId,
} from '../src/types/news.ts';
import {
  buildDefaultSourcesState,
  buildGoogleNewsDynamicRssUrl,
  canonicalizeSourceUrl,
  DEFAULT_ACTIVE_TOPIC_PACKS,
  DEFAULT_SEED_SOURCES,
  mergeSourcesStates,
  normalizeNewsSourceList,
  normalizeScanInterval,
  normalizeTopicPackIds,
} from '../src/lib/defaultSeedSources.ts';

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
const STORE_FILE_PATH = path.join(DATA_DIR, 'sources_store.json');
const STORE_TMP_PATH = path.join(DATA_DIR, 'sources_store.json.tmp');

let cachedState: PersistentSourcesState | null = null;
let hadExistingDiskStoreOnBoot = false;

function ensureDataDirectory(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function sanitizeStatePayload(raw: unknown): PersistentSourcesState {
  const fallback = buildDefaultSourcesState();
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }
  const obj = raw as Record<string, unknown>;
  const normalizedSources = normalizeNewsSourceList(obj.sources);
  const sources =
    normalizedSources.length > 0 ? normalizedSources : fallback.sources;

  const activeTopicPacks: TopicPackId[] = Array.isArray(obj.activeTopicPacks)
    ? normalizeTopicPackIds(obj.activeTopicPacks)
    : fallback.activeTopicPacks;

  const customKeywords = Array.isArray(obj.customKeywords)
    ? Array.from(
        new Set(
          obj.customKeywords
            .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
            .map((k) => k.trim().slice(0, 80))
        )
      ).slice(0, 20)
    : [];

  const botAutoScanEnabled =
    typeof obj.botAutoScanEnabled === 'boolean'
      ? obj.botAutoScanEnabled
      : fallback.botAutoScanEnabled;

  const autoFetchInterval = normalizeScanInterval(obj.autoFetchInterval);
  const updatedAt =
    typeof obj.updatedAt === 'string' && obj.updatedAt.trim().length > 0
      ? obj.updatedAt
      : new Date().toISOString();

  return {
    version: typeof obj.version === 'number' && obj.version > 0 ? obj.version : 1,
    updatedAt,
    sources,
    activeTopicPacks,
    customKeywords,
    botAutoScanEnabled,
    autoFetchInterval,
  };
}

/**
 * Atomic write-through to server/data/sources_store.json via .tmp + rename
 * to prevent JSON corruption if the server exits unexpectedly.
 */
export function saveSourcesToDisk(nextState: PersistentSourcesState): PersistentSourcesState {
  ensureDataDirectory();
  const sanitized = sanitizeStatePayload({
    ...nextState,
    updatedAt: nextState.updatedAt || new Date().toISOString(),
  });
  const serialized = JSON.stringify(sanitized, null, 2);
  fs.writeFileSync(STORE_TMP_PATH, serialized, 'utf8');
  fs.renameSync(STORE_TMP_PATH, STORE_FILE_PATH);
  cachedState = sanitized;
  return sanitized;
}

/**
 * Boot hydration: reads server/data/sources_store.json if present (never overwriting user edits),
 * or initializes the 35+ official DEFAULT_SEED_SOURCES on first launch.
 */
export function hydrateSourcesStoreOnBoot(): {
  state: PersistentSourcesState;
  hadExistingDiskStore: boolean;
  storePath: string;
} {
  ensureDataDirectory();

  if (fs.existsSync(STORE_FILE_PATH)) {
    try {
      const rawText = fs.readFileSync(STORE_FILE_PATH, 'utf8');
      const parsed = JSON.parse(rawText) as unknown;
      const hydrated = sanitizeStatePayload(parsed);
      cachedState = hydrated;
      hadExistingDiskStoreOnBoot = true;
      return {
        state: hydrated,
        hadExistingDiskStore: true,
        storePath: STORE_FILE_PATH,
      };
    } catch (err) {
      console.warn(
        '[persistentSourcesStore] Không thể đọc sources_store.json, khởi tạo lại từ DEFAULT_SEED_SOURCES:',
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  const initial = buildDefaultSourcesState();
  const saved = saveSourcesToDisk(initial);
  hadExistingDiskStoreOnBoot = false;
  return {
    state: saved,
    hadExistingDiskStore: false,
    storePath: STORE_FILE_PATH,
  };
}

export function getPersistedSourcesState(): {
  state: PersistentSourcesState;
  hadExistingDiskStore: boolean;
  storePath: string;
} {
  if (!cachedState) {
    return hydrateSourcesStoreOnBoot();
  }
  return {
    state: cachedState,
    hadExistingDiskStore: hadExistingDiskStoreOnBoot,
    storePath: STORE_FILE_PATH,
  };
}

/**
 * Reconciles/writes incoming client state to disk atomically.
 * mode = 'replace' writes incoming state directly (used on user edits/imports).
 * mode = 'merge' combines client localStorage state with server disk store on boot.
 */
export function syncSourcesStateToDisk(
  incomingRaw: unknown,
  mode: 'replace' | 'merge' = 'replace'
): PersistentSourcesState {
  const { state: current } = getPersistedSourcesState();
  const incoming = sanitizeStatePayload(incomingRaw);

  const nextState =
    mode === 'merge'
      ? mergeSourcesStates(incoming, current)
      : {
          ...incoming,
          updatedAt: incoming.updatedAt || new Date().toISOString(),
        };

  return saveSourcesToDisk(nextState);
}

/**
 * Restores all 35+ official DEFAULT_SEED_SOURCES across 7 Topic Packs while preserving
 * user-discovered / Watchlist / keyword custom sources if keepCustomSources is true.
 */
export function resetSourcesToOfficialDefaults(
  keepCustomSources = true
): PersistentSourcesState {
  const { state: current } = getPersistedSourcesState();
  const seedUrlSet = new Set(DEFAULT_SEED_SOURCES.map((s) => canonicalizeSourceUrl(s.url)));

  const customPreserved: NewsSourceConfig[] = keepCustomSources
    ? current.sources.filter(
        (s) => s.origin !== 'seed' && !seedUrlSet.has(canonicalizeSourceUrl(s.url))
      )
    : [];

  const nextState: PersistentSourcesState = {
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
    sources: [...DEFAULT_SEED_SOURCES.map((s) => ({ ...s })), ...customPreserved],
    activeTopicPacks: [...DEFAULT_ACTIVE_TOPIC_PACKS],
    customKeywords: current.customKeywords,
    botAutoScanEnabled: current.botAutoScanEnabled,
    autoFetchInterval: current.autoFetchInterval,
  };

  return saveSourcesToDisk(nextState);
}

/**
 * Generates & persists dynamic Google News RSS streams for Watchlist tickers.
 */
export function syncWatchlistDynamicSources(symbols: string[]): PersistentSourcesState {
  const { state: current } = getPersistedSourcesState();
  const cleanSyms = Array.from(
    new Set(
      symbols
        .map((s) => s.trim().toUpperCase())
        .filter((s) => /^[A-Z0-9]{2,8}$/.test(s))
    )
  ).slice(0, 12);

  if (cleanSyms.length === 0) return current;

  const byUrl = new Map<string, NewsSourceConfig>();
  for (const s of current.sources) {
    byUrl.set(canonicalizeSourceUrl(s.url), s);
  }

  let changed = false;
  for (const sym of cleanSyms) {
    const url = buildGoogleNewsDynamicRssUrl(`${sym} chứng khoán`);
    const canon = canonicalizeSourceUrl(url);
    if (!byUrl.has(canon)) {
      byUrl.set(canon, {
        id: `wl-gnews-${sym.toLowerCase()}`,
        name: `Google News · Watchlist ${sym}`,
        url,
        domain: 'news.google.com',
        defaultCategory: 'Kinh doanh',
        enabled: true,
        addedAt: new Date().toISOString(),
        packId: 'watchlist',
        kind: 'googlenews',
        origin: 'watchlist',
      });
      changed = true;
    }
  }

  if (!changed) return current;
  return saveSourcesToDisk({
    ...current,
    updatedAt: new Date().toISOString(),
    sources: Array.from(byUrl.values()),
  });
}

export function touchSourceLastFetched(sourceUrls: string[]): void {
  if (sourceUrls.length === 0) return;
  const { state: current } = getPersistedSourcesState();
  const urlSet = new Set(sourceUrls.map((u) => canonicalizeSourceUrl(u)));
  const nowIso = new Date().toISOString();
  let changed = false;

  const updatedSources = current.sources.map((s) => {
    if (urlSet.has(canonicalizeSourceUrl(s.url))) {
      changed = true;
      return { ...s, lastFetchedAt: nowIso };
    }
    return s;
  });

  if (changed) {
    saveSourcesToDisk({
      ...current,
      sources: updatedSources,
    });
  }
}
