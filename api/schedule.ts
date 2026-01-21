import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateArticlesParallel, selectBestArticle, ArticleOutline, AIConfig } from '../lib/ai-writers';

// Predefined topics for scheduled generation
const SCHEDULED_TOPICS = {
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

// Simple counter for topic rotation (in production, use database/KV store)
let topicCounter = 0;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret for scheduled calls
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('[Schedule] Unauthorized cron attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Determine category based on day of week
    // Monday (1) = kompensacja_mocy_biernej, Thursday (4) = kompensatory_svg
    const dayOfWeek = new Date().getDay();
    const category = dayOfWeek === 4 ? 'kompensatory_svg' : 'kompensacja_mocy_biernej';
    
    const topics = SCHEDULED_TOPICS[category];
    const topicIndex = topicCounter % topics.length;
    const selectedTopic = topics[topicIndex];
    
    // Increment counter for next run
    topicCounter++;

    console.log(`[Schedule] Running scheduled generation for ${category}, topic ${topicIndex}`);

    const outline: ArticleOutline = {
      ...selectedTopic,
      targetLength: 1500,
      category,
    };

    // Get AI config from environment
    const config: AIConfig = {
      geminiApiKey: process.env.GEMINI_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    };

    // Generate articles
    const articles = await generateArticlesParallel(outline, config);
    const bestArticle = selectBestArticle(articles);

    // TODO: Add Odoo integration here to publish article
    // const odooResult = await publishToOdoo(bestArticle);

    console.log(`[Schedule] Generated article: ${bestArticle.title} (${bestArticle.wordCount} words) by ${bestArticle.writer}`);

    return res.status(200).json({
      success: true,
      scheduled: true,
      category,
      topicIndex,
      article: {
        title: bestArticle.title,
        writer: bestArticle.writer,
        wordCount: bestArticle.wordCount,
        generatedAt: bestArticle.generatedAt,
      },
      nextTopicIndex: topicCounter % topics.length,
    });
  } catch (error) {
    console.error('[Schedule] Scheduled generation failed:', error);
    return res.status(500).json({
      error: 'Scheduled generation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}