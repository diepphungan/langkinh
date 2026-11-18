# Security Specification — Lăng Kính Firestore Database

## 1. Data Invariants
1. Every document under `/users/{userId}/fetchedArticles/{articleId}`, `/users/{userId}/customSources/{sourceId}`, `/users/{userId}/watchlistItems/{symbol}`, `/users/{userId}/financeAlerts/{alertId}`, `/users/{userId}/newsroomEditions/{editionKey}`, `/user_news_sources/{userId}`, and `/user_news_sources/{userId}/sources/{sourceId}` belongs exclusively to the authenticated, email-verified user matching `userId == request.auth.uid` and `data.ownerId == request.auth.uid`.
2. All path IDs (`userId`, `articleId`, `sourceId`, `symbol`, `alertId`, `editionKey`) must match `^[a-zA-Z0-9_\-]+$` and be at most 128 characters.
3. Every string field enforces strict `.size()` bounds matching `firebase-blueprint.json` (including serialized `storiesJson <= 16000` and `executiveHighlightsJson <= 2000` on `newsroomEditions`, plus URL regex `^https?://.+$` and bounded arrays `activeTopicPacks <= 12`, `customKeywords <= 24` on `user_news_sources`).
4. `createdAt` and `updatedAt` are server-validated via `request.time`; `ownerId`, `symbol`, `editionKey`, `sourceId`, and `createdAt` are immutable after creation.
5. Articles reaching terminal `status == 'archived'` cannot be modified further (only read or deleted by owner).
6. List queries enforce `resource.data.ownerId == request.auth.uid` at the rule level; subcollection `/user_news_sources/{userId}/sources/{sourceId}` verifies parent `/user_news_sources/{userId}` ownership on single-document operations.

## 2. Adversarial Test Cases ("Dirty Dozen" Invariants)
1. Unauthenticated read/list on `/users/{uid}/fetchedArticles`, `/users/{uid}/watchlistItems`, or `/users/{uid}/newsroomEditions` -> DENIED.
2. Unverified email (`email_verified == false`) write -> DENIED.
3. Cross-user read/write (`request.auth.uid != userId`) -> DENIED.
4. Forged `ownerId` in payload (`ownerId != request.auth.uid`) -> DENIED.
5. Oversized doc ID (>128 chars) or invalid characters (`../bad`) -> DENIED.
6. Shadow/ghost field injection (`isAdmin: true`) -> DENIED via `keys().hasOnly(...)`.
7. Client-forged `createdAt` or `updatedAt` != `request.time` -> DENIED.
8. Mutating `ownerId`, `symbol`, `editionKey`, or `createdAt` on update -> DENIED.
9. Updating an already `archived` article -> DENIED.
10. Oversized `title` (>300 chars), `summary` (>1500 chars), `storiesJson` (>16000 chars), or `notes` -> DENIED.
11. Non-HTTP(S) `url` (`javascript:alert(1)`) -> DENIED via regex `^https?://.+`.
12. Out-of-range numeric thresholds (`priceChangeThresholdPct > 50` or `< 0`), invalid `severity`, invalid `editionType`, or invalid `newsSensitivity` -> DENIED.
