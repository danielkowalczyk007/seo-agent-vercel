import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateArticlesParallel, selectBestArticle, ArticleOutline, AIConfig } from '../lib/ai-writers';

// Predefined topics for each category
const TOPICS = {
  kompensacja_mocy_biernej: [
    {
      topic: 'Kompensacja mocy biernej w przemyśle - kompleksowy przewodnik',
      keywords: ['kompensacja mocy biernej', 'baterie kondensatorów', 'cos phi', 'opłaty za moc bierną'],
      sections: ['Czym jest moc bierna', 'Rodzaje kompensacji', 'Dobór baterii kondensatorów', 'Korzyści finansowe', 'FAQ'],
    },
    {
      topic: 'Jak obniżyć rachunki za energię dzięki kompensacji mocy biernej',
      keywords: ['oszczędności energia', 'kompensacja mocy biernej', 'redukcja kosztów', 'opłaty OSD'],
      sections: ['Analiza rachunku za energię', 'Obliczanie strat', 'Rozwiązania kompensacji', 'ROI inwestycji', 'FAQ'],
    },
  ],
  kompensatory_svg: [
    {
      topic: 'Kompensatory SVG vs baterie kondensatorów - porównanie technologii',
      keywords: ['kompensator SVG', 'statyczny kompensator', 'STATCOM', 'jakość energii'],
      sections: ['Zasada działania SVG', 'Porównanie z kondensatorami', 'Zastosowania przemysłowe', 'Analiza kosztów', 'FAQ'],
    },
    {
      topic: 'Kompensatory SVG w instalacjach fotowoltaicznych',
      keywords: ['SVG fotowoltaika', 'kompensacja PV', 'harmoniczne', 'jakość energii OZE'],
      sections: ['Problemy jakości energii w PV', 'Rozwiązanie SVG', 'Integracja z instalacją', 'Case study', 'FAQ'],
    },
  ],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional API key authentication
  const apiSecret = process.env.API_SECRET;
  if (apiSecret) {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${apiSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const { category, topicIndex } = req.body as { category?: string; topicIndex?: number };

    // Validate category
    const validCategory = category === 'kompensatory_svg' ? 'kompensatory_svg' : 'kompensacja_mocy_biernej';
    const topics = TOPICS[validCategory];
    
    // Select topic
    const index = typeof topicIndex === 'number' ? topicIndex % topics.length : 0;
    const selectedTopic = topics[index];

    const outline: ArticleOutline = {
      ...selectedTopic,
      targetLength: 1500,
      category: validCategory,
    };

    // Get AI config from environment
    const config: AIConfig = {
      geminiApiKey: process.env.GEMINI_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    };

    // Generate articles in parallel
    console.log('[API] Starting article generation for:', outline.topic);
    const articles = await generateArticlesParallel(outline, config);

    // Select best article
    const bestArticle = selectBestArticle(articles);

    // Return results
    return res.status(200).json({
      success: true,
      article: {
        title: bestArticle.title,
        content: bestArticle.content,
        writer: bestArticle.writer,
        wordCount: bestArticle.wordCount,
        generatedAt: bestArticle.generatedAt,
      },
      allArticles: articles.map(a => ({
        writer: a.writer,
        wordCount: a.wordCount,
      })),
      outline,
    });
  } catch (error) {
    console.error('[API] Generation failed:', error);
    return res.status(500).json({
      error: 'Generation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}