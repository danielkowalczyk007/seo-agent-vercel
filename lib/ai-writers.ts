/**
 * AI Writers Module - Vercel Version
 * Parallel content generation using Gemini, ChatGPT, and Claude
 * 
 * CHANGES FROM MANUS VERSION:
 * - Removed OpenRouter dependency for ChatGPT (direct OpenAI API)
 * - Optimized for Vercel Serverless Functions
 * - Added better error handling and logging
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Types
export interface ArticleOutline {
  topic: string;
  keywords: string[];
  targetLength: number;
  sections: string[];
  category: 'kompensacja_mocy_biernej' | 'kompensatory_svg';
}

export interface GeneratedArticle {
  title: string;
  content: string;
  writer: 'gemini' | 'chatgpt' | 'claude';
  wordCount: number;
  generatedAt: Date;
  scores?: {
    seo: number;
    readability: number;
    engagement: number;
    total: number;
  };
}

export interface AIConfig {
  geminiApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
}

const WRITING_INSTRUCTIONS = `
Jesteś ekspertem SEO content writer specjalizującym się w branży energetycznej i kompensacji mocy biernej.

## WYMAGANIA STYLISTYCZNE:
- Pisz w języku polskim
- Używaj profesjonalnego, ale przystępnego tonu
- Stosuj formatowanie HTML (h2, h3, p, ul, li, strong, em)
- Długość: zgodna z targetLength (±10%)

## STRUKTURA ARTYKUŁU:
1. **Wstęp** (hook + zapowiedź treści)
2. **Sekcje główne** (h2 z podsekcjami h3)
3. **FAQ** (5-7 pytań i odpowiedzi)
4. **Podsumowanie** z Call-to-Action

## SEO REQUIREMENTS:
- Słowo kluczowe główne w pierwszym akapicie
- Słowa kluczowe w nagłówkach h2/h3
- Gęstość słów kluczowych: 1-2%
- Meta description w pierwszych 160 znakach
- Linkowanie wewnętrzne (placeholder: [INTERNAL_LINK])

## ENGAGEMENT ELEMENTS:
- Cytowalne fragmenty (featured snippets)
- Tabele porównawcze gdzie pasuje
- Listy punktowane i numerowane
- Definicje kluczowych terminów
- Statystyki i dane liczbowe

## FORMAT OUTPUT:
Zwróć TYLKO czysty HTML artykułu, bez markdown, bez bloków kodu.
`;

function createPrompt(outline: ArticleOutline): string {
  return `${WRITING_INSTRUCTIONS}

---

# YOUR TASK

Write a comprehensive blog post based on:

**Topic**: ${outline.topic}
**Keywords**: ${outline.keywords.join(', ')}
**Target Length**: ${outline.targetLength} words
**Required Sections**: ${outline.sections.join(', ')}
**Category**: ${outline.category === 'kompensacja_mocy_biernej' ? 'Kompensacja mocy biernej' : 'Kompensatory SVG'}

**CRITICAL REQUIREMENTS**:
1. Follow ALL instructions from the writing guide above
2. Write in Polish language
3. Format in HTML with semantic tags
4. Include ALL required elements
5. Optimize for both SEO and GEO
6. Include placeholder [INTERNAL_LINK] for internal linking

BEGIN WRITING THE ARTICLE NOW:`;
}

export async function writeWithGemini(
  outline: ArticleOutline,
  apiKey: string
): Promise<GeneratedArticle> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  const prompt = createPrompt(outline);
  console.log('[Gemini] Starting generation for:', outline.topic);
  const startTime = Date.now();

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const content = response.text();
  const wordCount = content.split(/\s+/).length;

  console.log(`[Gemini] Completed in ${Date.now() - startTime}ms, ${wordCount} words`);

  return {
    title: outline.topic,
    content,
    writer: 'gemini',
    wordCount,
    generatedAt: new Date(),
  };
}

export async function writeWithChatGPT(
  outline: ArticleOutline,
  apiKey: string
): Promise<GeneratedArticle> {
  const client = new OpenAI({ apiKey });

  const prompt = createPrompt(outline);
  console.log('[ChatGPT] Starting generation for:', outline.topic);
  const startTime = Date.now();

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are an expert SEO content writer specializing in renewable energy and power factor compensation systems. Always write in Polish.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 4000,
  });

  const content = response.choices[0]?.message?.content || '';
  const wordCount = content.split(/\s+/).length;

  console.log(`[ChatGPT] Completed in ${Date.now() - startTime}ms, ${wordCount} words`);

  return {
    title: outline.topic,
    content,
    writer: 'chatgpt',
    wordCount,
    generatedAt: new Date(),
  };
}

export async function writeWithClaude(
  outline: ArticleOutline,
  apiKey: string
): Promise<GeneratedArticle> {
  const client = new Anthropic({ apiKey });

  const prompt = createPrompt(outline);
  console.log('[Claude] Starting generation for:', outline.topic);
  const startTime = Date.now();

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const content = response.content[0]?.type === 'text'
    ? response.content[0].text
    : '';
  const wordCount = content.split(/\s+/).length;

  console.log(`[Claude] Completed in ${Date.now() - startTime}ms, ${wordCount} words`);

  return {
    title: outline.topic,
    content,
    writer: 'claude',
    wordCount,
    generatedAt: new Date(),
  };
}

export async function generateArticlesParallel(
  outline: ArticleOutline,
  config: AIConfig
): Promise<GeneratedArticle[]> {
  console.log('[AI Writers] Starting parallel generation for:', outline.topic);
  const startTime = Date.now();

  const promises: Promise<GeneratedArticle>[] = [];
  const writerNames: string[] = [];

  if (config.geminiApiKey) {
    promises.push(writeWithGemini(outline, config.geminiApiKey));
    writerNames.push('Gemini');
  }
  if (config.openaiApiKey) {
    promises.push(writeWithChatGPT(outline, config.openaiApiKey));
    writerNames.push('ChatGPT');
  }
  if (config.anthropicApiKey) {
    promises.push(writeWithClaude(outline, config.anthropicApiKey));
    writerNames.push('Claude');
  }

  if (promises.length === 0) {
    throw new Error('No API keys configured. At least one AI provider is required.');
  }

  console.log(`[AI Writers] Using models: ${writerNames.join(', ')}`);

  const results = await Promise.allSettled(promises);
  const articles: GeneratedArticle[] = [];

  results.forEach((result, index) => {
    const writerName = writerNames[index];
    if (result.status === 'fulfilled') {
      articles.push(result.value);
      console.log(`[AI Writers] ${writerName} completed: ${result.value.wordCount} words`);
    } else {
      console.error(`[AI Writers] ${writerName} failed:`, result.reason);
    }
  });

  if (articles.length === 0) {
    throw new Error('All AI writers failed to generate content');
  }

  console.log(`[AI Writers] Completed ${articles.length}/${promises.length} articles in ${Date.now() - startTime}ms`);

  return articles;
}

export function selectBestArticle(articles: GeneratedArticle[]): GeneratedArticle {
  if (articles.length === 0) {
    throw new Error('No articles to select from');
  }

  if (articles.length === 1) {
    return articles[0];
  }

  const scored = articles.map(article => ({
    article,
    score: article.scores?.total || article.wordCount,
  }));

  scored.sort((a, b) => b.score - a.score);
  
  console.log(`[AI Writers] Selected best article from ${scored[0].article.writer} with score ${scored[0].score}`);
  
  return scored[0].article;
}