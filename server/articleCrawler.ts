import * as cheerio from 'cheerio';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { CrawledArticleResult } from '../src/types/news.ts';
import { validatePublicHttpUrl } from './newsSources.ts';
import { processSingleArticle } from './newsPipeline.ts';

const MODEL_NAME = 'gemini-4-hydrogen';

const CONTENT_CONTAINER_SELECTORS = [
  'article.fck_detail',
  '.fck_detail',
  '.detail-content',
  '.singular-content',
  '.maincontent',
  '.content-detail',
  '#main-detail-body',
  '.article-body',
  '.entry-content',
  'article',
  'main',
];

function cleanText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

function extractJsonLdMetadata($: cheerio.CheerioAPI): {
  headline?: string;
  datePublished?: string;
  keywords?: string[];
  image?: string;
} {
  const result: {
    headline?: string;
    datePublished?: string;
    keywords?: string[];
    image?: string;
  } = {};

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const text = $(el).text();
      if (!text) return;
      const parsed = JSON.parse(text);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue;
        if (!result.headline && typeof node.headline === 'string') {
          result.headline = cleanText(node.headline);
        }
        if (!result.datePublished && typeof node.datePublished === 'string') {
          result.datePublished = cleanText(node.datePublished);
        }
        if (!result.keywords && node.keywords) {
          if (Array.isArray(node.keywords)) {
            result.keywords = node.keywords
              .map((k: unknown) => (typeof k === 'string' ? cleanText(k) : ''))
              .filter(Boolean);
          } else if (typeof node.keywords === 'string') {
            result.keywords = node.keywords
              .split(',')
              .map((k: string) => cleanText(k))
              .filter(Boolean);
          }
        }
        if (!result.image && node.image) {
          if (typeof node.image === 'string') {
            result.image = node.image;
          } else if (Array.isArray(node.image) && typeof node.image[0] === 'string') {
            result.image = node.image[0];
          } else if (typeof node.image?.url === 'string') {
            result.image = node.image.url;
          }
        }
      }
    } catch {
      // ignore malformed json-ld
    }
  });

  return result;
}

function resolveUrlMaybe(candidate: string | undefined, baseUrl: string): string | null {
  if (!candidate) return null;
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

export async function fetchAndParseHtmlArticle(url: string): Promise<{
  title: string;
  publishedDate: string;
  keywords: string[];
  topImage: string | null;
  contentParagraphs: string[];
} | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(9000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (!html || html.length < 300) return null;

    const $ = cheerio.load(html);
    const jsonLd = extractJsonLdMetadata($);

    const title =
      cleanText($('meta[property="og:title"]').attr('content') || '') ||
      cleanText($('meta[name="twitter:title"]').attr('content') || '') ||
      jsonLd.headline ||
      cleanText($('h1').first().text()) ||
      cleanText($('title').first().text());

    const publishedDate =
      cleanText($('meta[property="article:published_time"]').attr('content') || '') ||
      cleanText($('meta[name="pubdate"]').attr('content') || '') ||
      cleanText($('meta[name="publishdate"]').attr('content') || '') ||
      cleanText($('meta[itemprop="datePublished"]').attr('content') || '') ||
      jsonLd.datePublished ||
      cleanText($('time[datetime]').first().attr('datetime') || '') ||
      cleanText($('.date, .time, .publish-date').first().text());

    const rawKeywords =
      $('meta[name="keywords"]').attr('content') ||
      $('meta[name="news_keywords"]').attr('content') ||
      '';
    const metaKeywords = rawKeywords
      .split(',')
      .map((k) => cleanText(k))
      .filter(Boolean);
    const keywords =
      metaKeywords.length > 0
        ? metaKeywords.slice(0, 10)
        : (jsonLd.keywords || []).slice(0, 10);

    const topImage =
      resolveUrlMaybe($('meta[property="og:image"]').attr('content'), url) ||
      resolveUrlMaybe($('meta[name="twitter:image"]').attr('content'), url) ||
      resolveUrlMaybe(jsonLd.image, url);

    // Strip noise before extracting paragraphs
    $(
      'script, style, noscript, iframe, nav, footer, header, aside, .box-tinlienquan, .related-news, .box-category, .comment, #comment, .ads, .advertisement'
    ).remove();

    let paragraphs: string[] = [];
    for (const selector of CONTENT_CONTAINER_SELECTORS) {
      const container = $(selector).first();
      if (container.length === 0) continue;
      const candidateParagraphs: string[] = [];
      container.find('p').each((_, pEl) => {
        const text = cleanText($(pEl).text());
        if (text.length >= 25) {
          candidateParagraphs.push(text);
        }
      });
      if (candidateParagraphs.length >= 2) {
        paragraphs = candidateParagraphs;
        break;
      }
    }

    if (paragraphs.length === 0) {
      $('p').each((_, pEl) => {
        const text = cleanText($(pEl).text());
        if (text.length >= 40) {
          paragraphs.push(text);
        }
      });
    }

    // Include description/sapo at the top if not already duplicated
    const description = cleanText(
      $('meta[property="og:description"]').attr('content') ||
        $('meta[name="description"]').attr('content') ||
        ''
    );
    if (
      description.length >= 30 &&
      !paragraphs.some((p) => p.includes(description.slice(0, 40)))
    ) {
      paragraphs.unshift(description);
    }

    const combinedText = paragraphs.join(' ');
    if (combinedText.length < 100) {
      return null;
    }

    return {
      title: title || 'Bài viết đã trích xuất',
      publishedDate: publishedDate || 'Không rõ ngày đăng',
      keywords,
      topImage,
      contentParagraphs: paragraphs.slice(0, 35),
    };
  } catch {
    return null;
  }
}

async function crawlArticleWithGeminiFallback(
  ai: GoogleGenAI,
  url: string
): Promise<{
  title: string;
  publishedDate: string;
  keywords: string[];
  topImage: string | null;
  contentParagraphs: string[];
}> {
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Hãy truy cập đường dẫn bài báo sau và trích xuất nội dung chi tiết của bài báo: ${url}
Trả về DUY NHẤT một khối JSON hợp lệ theo cấu trúc:
{
  "title": "Tiêu đề chính xác của bài báo",
  "publishedDate": "Ngày/giờ xuất bản nếu có, hoặc chuỗi rỗng",
  "keywords": ["từ khóa 1", "từ khóa 2", "từ khóa 3"],
  "contentParagraphs": [
    "Đoạn văn mở đầu / sapo của bài báo...",
    "Đoạn văn nội dung chính 1...",
    "Đoạn văn nội dung chính 2..."
  ]
}`,
    config: {
      tools: [{ urlContext: {} }],
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  const raw = (response.text || '').trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const jsonText = fence?.[1]
    ? fence[1].trim()
    : raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  const parsed = JSON.parse(jsonText) as {
    title?: string;
    publishedDate?: string;
    keywords?: string[];
    contentParagraphs?: string[];
  };

  return {
    title: parsed.title || 'Bài viết từ URL',
    publishedDate: parsed.publishedDate || 'Không rõ ngày đăng',
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 10) : [],
    topImage: null,
    contentParagraphs: Array.isArray(parsed.contentParagraphs)
      ? parsed.contentParagraphs.filter((p) => typeof p === 'string' && p.trim().length > 0)
      : [],
  };
}

export async function crawlArticleFromUrl(
  ai: GoogleGenAI,
  rawUrl: string,
  options?: { runNlp?: boolean; categories?: string[] }
): Promise<CrawledArticleResult> {
  const parsedUrl = validatePublicHttpUrl(rawUrl);
  const cleanUrl = parsedUrl.toString();
  const sourceDomain = parsedUrl.hostname.replace(/^www\./, '');

  let crawlMethod: 'HTML DOM' | 'Gemini URL Context' = 'HTML DOM';
  let extracted = await fetchAndParseHtmlArticle(cleanUrl);

  if (!extracted) {
    crawlMethod = 'Gemini URL Context';
    extracted = await crawlArticleWithGeminiFallback(ai, cleanUrl);
  }

  const fullText = extracted.contentParagraphs.join('\n\n');
  const wordCount = fullText.trim() ? fullText.trim().split(/\s+/).length : 0;

  let nlpAnalysis;
  if (options?.runNlp !== false && fullText.length > 0) {
    try {
      nlpAnalysis = await processSingleArticle(ai, {
        title: extracted.title,
        text: fullText,
        categories: options?.categories,
        summaryLength: 'tieu-chuan',
      });
    } catch {
      // Allow DOM crawl result to return cleanly even when Gemini is rate-limited
      nlpAnalysis = undefined;
    }
  }

  return {
    url: cleanUrl,
    sourceDomain,
    title: extracted.title,
    publishedDate: extracted.publishedDate,
    keywords: extracted.keywords,
    topImage: extracted.topImage,
    contentParagraphs: extracted.contentParagraphs,
    wordCount,
    crawlMethod,
    nlpAnalysis,
  };
}
