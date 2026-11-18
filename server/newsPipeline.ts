import { GoogleGenAI, ThinkingLevel, Type, GenerateContentResponse } from '@google/genai';
import type {
  ArticleProcessResult,
  BatchClassifyResponse,
  GroundingSource,
  SentimentVerdict,
  SummaryLengthOption,
} from '../src/types/news.ts';

export const DEFAULT_PREDEFINED_CATEGORIES = [
  'Kinh doanh',
  'Giải trí',
  'Khoa học',
  'Công nghệ',
  'Thể thao',
  'Sức khỏe',
  'Chính trị & Xã hội',
  'Thế giới',
];

const MODEL_NAME = 'gemini-4-hydrogen';

function countWords(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function normalizeVerdict(raw?: string): SentimentVerdict {
  const lower = (raw || '').toLowerCase();
  if (lower.includes('tích cực') || lower.includes('positive')) return 'Tích cực';
  if (lower.includes('tiêu cực') || lower.includes('negative')) return 'Tiêu cực';
  return 'Trung lập';
}

function normalizeThreeScores(pos: number, neu: number, neg: number) {
  const p = Math.max(0, Math.round(Number(pos) || 0));
  const u = Math.max(0, Math.round(Number(neu) || 0));
  const n = Math.max(0, Math.round(Number(neg) || 0));
  const total = p + u + n;
  if (total <= 0) {
    return { positive: 33, neutral: 34, negative: 33 };
  }
  const np = Math.round((p / total) * 100);
  const nu = Math.round((u / total) * 100);
  const nn = Math.max(0, 100 - np - nu);
  return { positive: np, neutral: nu, negative: nn };
}

function extractGroundingSources(response: GenerateContentResponse): GroundingSource[] {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];
  const seen = new Set<string>();
  const sources: GroundingSource[] = [];
  for (const chunk of chunks) {
    const uri = chunk.web?.uri?.trim();
    const title = chunk.web?.title?.trim();
    if (uri && !seen.has(uri)) {
      seen.add(uri);
      sources.push({
        uri,
        title: title || uri,
      });
    }
  }
  return sources.slice(0, 8);
}

function parseJsonSafe<T>(text: string | undefined): T {
  if (!text) {
    throw new Error('EMPTY_MODEL_RESPONSE');
  }
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fence?.[1]) {
      return JSON.parse(fence[1].trim()) as T;
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as T;
    }
    throw new Error('INVALID_JSON_FORMAT');
  }
}

export async function processSingleArticle(
  ai: GoogleGenAI,
  params: {
    title?: string;
    text?: string;
    url?: string;
    categories?: string[];
    summaryLength?: SummaryLengthOption;
  }
): Promise<ArticleProcessResult> {
  const categories =
    Array.isArray(params.categories) && params.categories.length > 0
      ? params.categories
      : DEFAULT_PREDEFINED_CATEGORIES;
  const summaryLength: SummaryLengthOption =
    params.summaryLength === 'ngan' ? 'ngan' : 'tieu-chuan';

  const summaryRule =
    summaryLength === 'ngan'
      ? 'Tóm tắt cực kỳ súc tích trong 1-2 câu (khoảng 30-45 từ) và 2 điểm chính ngắn gọn.'
      : 'Tóm tắt ngắn gọn trong 2-3 câu (khoảng 50-80 từ) và 3-4 điểm chính nêu bật số liệu, sự kiện, hệ quả.';

  const contentParts = [
    params.url ? `URL bài báo cần đọc nội dung: ${params.url}` : '',
    params.title ? `Tiêu đề bài báo: ${params.title}` : '',
    params.text ? `Nội dung bài báo:\n"""\n${params.text.slice(0, 15000)}\n"""` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const prompt = `Bạn là hệ thống NLP xử lý tin tức tiếng Việt gồm 3 module chuyên biệt:
1. PHÂN LOẠI CHỦ ĐỀ TỰ ĐỘNG: Bắt buộc gán bài báo vào ĐÚNG MỘT danh mục chính nằm trong danh sách định trước sau đây: [${categories.join(', ')}]. Có thể gợi ý thêm 1 danh mục phụ (hoặc null nếu không rõ). Giải thích ngắn gọn tín hiệu từ vựng/chủ đề dẫn đến phân loại đó.
2. TÓM TẮT TIN TỨC TỰ ĐỘNG: ${summaryRule}
3. MODULE PHÂN TÍCH CẢM XÚC: Phân loại cảm xúc tổng thể của bài báo thành một trong 3 nhãn chính xác: "Tích cực", "Tiêu cực", hoặc "Trung lập" dựa trên nội dung, ngữ điệu và thông điệp của bài viết. Trích xuất 2-4 cụm từ hoặc mệnh đề thực tế trong bài làm bằng chứng cảm xúc, và ước lượng tỷ lệ sắc thái (positive + neutral + negative = 100).

Dữ liệu đầu vào:
${contentParts}`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      classification: {
        type: Type.OBJECT,
        properties: {
          primaryCategory: { type: Type.STRING },
          confidencePercent: { type: Type.INTEGER },
          secondaryCategory: { type: Type.STRING, nullable: true },
          topicSignals: { type: Type.ARRAY, items: { type: Type.STRING } },
          rationale: { type: Type.STRING },
        },
        required: [
          'primaryCategory',
          'confidencePercent',
          'topicSignals',
          'rationale',
        ],
      },
      summary: {
        type: Type.OBJECT,
        properties: {
          generatedTitle: { type: Type.STRING },
          conciseSummary: { type: Type.STRING },
          keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['generatedTitle', 'conciseSummary', 'keyPoints'],
      },
      sentiment: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          confidencePercent: { type: Type.INTEGER },
          positive: { type: Type.INTEGER },
          neutral: { type: Type.INTEGER },
          negative: { type: Type.INTEGER },
          toneLabel: { type: Type.STRING },
          evidencePhrases: { type: Type.ARRAY, items: { type: Type.STRING } },
          explanation: { type: Type.STRING },
        },
        required: [
          'label',
          'confidencePercent',
          'positive',
          'neutral',
          'negative',
          'toneLabel',
          'evidencePhrases',
          'explanation',
        ],
      },
    },
    required: ['classification', 'summary', 'sentiment'],
  };

  interface RawSingleResult {
    classification: {
      primaryCategory: string;
      confidencePercent: number;
      secondaryCategory?: string | null;
      topicSignals: string[];
      rationale: string;
    };
    summary: {
      generatedTitle: string;
      conciseSummary: string;
      keyPoints: string[];
    };
    sentiment: {
      label: string;
      confidencePercent: number;
      positive: number;
      neutral: number;
      negative: number;
      toneLabel: string;
      evidencePhrases: string[];
      explanation: string;
    };
  }

  let parsed: RawSingleResult;
  let groundingSources: GroundingSource[] = [];

  if (params.url) {
    // When using urlContext tool, guide JSON output directly and extract cleanly
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `${prompt}\n\nTrả về DUY NHẤT một khối JSON hợp lệ có các trường: classification { primaryCategory, confidencePercent, secondaryCategory, topicSignals, rationale }, summary { generatedTitle, conciseSummary, keyPoints }, sentiment { label, confidencePercent, positive, neutral, negative, toneLabel, evidencePhrases, explanation }.`,
      config: {
        tools: [{ urlContext: {} }],
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    parsed = parseJsonSafe<RawSingleResult>(response.text);
    groundingSources = extractGroundingSources(response);
  } else {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    parsed = parseJsonSafe<RawSingleResult>(response.text);
  }

  const originalText = params.text?.trim() || params.title?.trim() || params.url || '';
  const originalWordCount = countWords(originalText);
  const summaryTextCombined = `${parsed.summary.conciseSummary} ${parsed.summary.keyPoints.join(' ')}`;
  const summaryWordCount = countWords(parsed.summary.conciseSummary);
  const compressionPercent =
    originalWordCount > summaryWordCount && originalWordCount > 0
      ? Math.max(10, Math.min(95, Math.round((1 - summaryWordCount / originalWordCount) * 100)))
      : 0;

  const scores = normalizeThreeScores(
    parsed.sentiment.positive,
    parsed.sentiment.neutral,
    parsed.sentiment.negative
  );

  // Ensure primaryCategory matches predefined list if close
  const matchedCategory =
    categories.find(
      (c) => c.toLowerCase() === (parsed.classification.primaryCategory || '').toLowerCase()
    ) ||
    parsed.classification.primaryCategory ||
    categories[0];

  return {
    id: `nlp-${Date.now()}`,
    processedAt: new Date().toISOString(),
    inputExcerpt:
      originalText.length > 180 ? `${originalText.slice(0, 180)}...` : originalText,
    classification: {
      primaryCategory: matchedCategory,
      confidencePercent: Math.max(50, Math.min(99, Math.round(parsed.classification.confidencePercent || 88))),
      secondaryCategory: parsed.classification.secondaryCategory || null,
      topicSignals: Array.isArray(parsed.classification.topicSignals)
        ? parsed.classification.topicSignals.slice(0, 5)
        : [],
      rationale: parsed.classification.rationale || '',
    },
    summary: {
      generatedTitle: parsed.summary.generatedTitle || params.title || 'Bản tóm tắt tin tức',
      conciseSummary: parsed.summary.conciseSummary || summaryTextCombined,
      keyPoints: Array.isArray(parsed.summary.keyPoints)
        ? parsed.summary.keyPoints.slice(0, 5)
        : [],
      originalWordCount,
      summaryWordCount,
      compressionPercent,
    },
    sentiment: {
      label: normalizeVerdict(parsed.sentiment.label),
      confidencePercent: Math.max(50, Math.min(99, Math.round(parsed.sentiment.confidencePercent || 85))),
      scores: {
        ...scores,
        toneLabel: parsed.sentiment.toneLabel || normalizeVerdict(parsed.sentiment.label),
      },
      evidencePhrases: Array.isArray(parsed.sentiment.evidencePhrases)
        ? parsed.sentiment.evidencePhrases.slice(0, 4)
        : [],
      explanation: parsed.sentiment.explanation || '',
    },
    groundingSources,
  };
}

export async function processBatchArticles(
  ai: GoogleGenAI,
  params: {
    articles: { title?: string; text: string }[];
    categories?: string[];
  }
): Promise<BatchClassifyResponse> {
  const categories =
    Array.isArray(params.categories) && params.categories.length > 0
      ? params.categories
      : DEFAULT_PREDEFINED_CATEGORIES;

  const trimmedArticles = params.articles
    .map((a, idx) => ({
      index: idx + 1,
      title: a.title?.trim() || '',
      text: a.text.trim().slice(0, 2500),
    }))
    .filter((a) => a.text.length > 0)
    .slice(0, 12);

  if (trimmedArticles.length === 0) {
    throw new Error('NO_VALID_ARTICLES');
  }

  const serializedList = trimmedArticles
    .map(
      (a) =>
        `[Bài #${a.index}]${a.title ? ` Tiêu đề: ${a.title}` : ''}\nNội dung: ${a.text}`
    )
    .join('\n\n---\n\n');

  const prompt = `Bạn là hệ thống xử lý tin tức tự động hàng loạt.
Hãy xử lý từng bài báo trong danh sách dưới đây:
1. Gán mỗi bài vào ĐÚNG MỘT danh mục trong danh sách định trước: [${categories.join(', ')}].
2. Phân loại cảm xúc từng bài thành: "Tích cực", "Tiêu cực", hoặc "Trung lập" kèm phân bổ điểm (positive + neutral + negative = 100).
3. Viết tóm tắt 1 câu ngắn gọn và 1 điểm cốt lõi nổi bật nhất cho mỗi bài.

Danh sách bài báo (${trimmedArticles.length} bài):
${serializedList}`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            index: { type: Type.INTEGER },
            title: { type: Type.STRING },
            primaryCategory: { type: Type.STRING },
            confidencePercent: { type: Type.INTEGER },
            sentimentLabel: { type: Type.STRING },
            positive: { type: Type.INTEGER },
            neutral: { type: Type.INTEGER },
            negative: { type: Type.INTEGER },
            shortSummary: { type: Type.STRING },
            keyTakeaway: { type: Type.STRING },
          },
          required: [
            'index',
            'title',
            'primaryCategory',
            'confidencePercent',
            'sentimentLabel',
            'positive',
            'neutral',
            'negative',
            'shortSummary',
            'keyTakeaway',
          ],
        },
      },
    },
    required: ['items'],
  };

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  const parsed = parseJsonSafe<{
    items: Array<{
      index: number;
      title: string;
      primaryCategory: string;
      confidencePercent: number;
      sentimentLabel: string;
      positive: number;
      neutral: number;
      negative: number;
      shortSummary: string;
      keyTakeaway: string;
    }>;
  }>(response.text);

  const items = (parsed.items || []).map((item, idx) => {
    const sourceArticle = trimmedArticles[idx] || trimmedArticles[item.index - 1];
    const scores = normalizeThreeScores(item.positive, item.neutral, item.negative);
    const matchedCat =
      categories.find(
        (c) => c.toLowerCase() === (item.primaryCategory || '').toLowerCase()
      ) ||
      item.primaryCategory ||
      categories[0];

    const rawText = sourceArticle?.text || '';
    return {
      index: item.index || idx + 1,
      title: item.title || sourceArticle?.title || `Bài báo #${idx + 1}`,
      excerpt: rawText.length > 120 ? `${rawText.slice(0, 120)}...` : rawText,
      primaryCategory: matchedCat,
      confidencePercent: Math.max(55, Math.min(99, Math.round(item.confidencePercent || 88))),
      sentimentLabel: normalizeVerdict(item.sentimentLabel),
      sentimentScorePositive: scores.positive,
      sentimentScoreNeutral: scores.neutral,
      sentimentScoreNegative: scores.negative,
      shortSummary: item.shortSummary || '',
      keyTakeaway: item.keyTakeaway || '',
    };
  });

  return {
    processedAt: new Date().toISOString(),
    categoriesUsed: categories,
    items,
  };
}
