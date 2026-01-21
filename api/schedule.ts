/**
 * Vercel Cron Job: Scheduled Publication
 * GET /api/schedule
 * 
 * Triggered by Vercel Cron:
 * - Monday 9:00 CET: kompensacja_mocy_biernej
 * - Thursday 9:00 CET: kompensatory_svg
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  generateArticlesParallel, 
  selectBestArticle,
  type ArticleOutline,
  type AIConfig 
} from '../lib/ai-writers';

// Predefined topics for rotation
const TOPICS = {
  kompensacja_mocy_biernej: [
    {
      topic: 'Kompensacja mocy biernej - podstawy i korzyści dla przedsiębiorstw',
      keywords: ['kompensacja mocy biernej', 'oszczędności energii', 'koszty energii', 'współczynnik mocy'],
      sections: ['Czym jest moc bierna', 'Dlaczego warto kompensować', 'Korzyści finansowe', 'FAQ'],
    },
    {
      topic: 'Jak obliczyć zapotrzebowanie na kompensację mocy biernej?',
      keywords: ['obliczanie mocy biernej', 'kalkulacja kompensacji', 'analiza energetyczna'],
      sections: ['Wzory obliczeniowe', 'Przykłady praktyczne', 'Narzędzia do obliczeń', 'FAQ'],
    },
    {
      topic: 'Kary za niską wartość współczynnika mocy cosφ - jak ich uniknąć?',
      keywords: ['kary za moc bierną', 'współczynnik mocy', 'cosφ', 'opłaty za energię'],
      sections: ['Regulacje prawne', 'Wysokość kar', 'Metody unikania kar', 'FAQ'],
    },
    {
      topic: 'Kompensacja mocy biernej w instalacjach przemysłowych - case study',
      keywords: ['kompensacja przemysłowa', 'instalacje fabryczne', 'optymalizacja energii'],
      sections: ['Opis problemu', 'Rozwiązanie', 'Wyniki', 'Wnioski', 'FAQ'],
    },
  ],
  kompensatory_svg: [
    {
      topic: 'Kompensatory SVG vs tradycyjne baterie kondensatorów - porównanie',
      keywords: ['kompensator SVG', 'bateria kondensatorów', 'porównanie systemów'],
      sections: ['Zasada działania SVG', 'Zalety i wady', 'Kiedy wybrać SVG', 'FAQ'],
    },
    {
      topic: 'Instalacja i uruchomienie kompensatora SVG - przewodnik techniczny',
      keywords: ['instalacja SVG', 'uruchomienie kompensatora', 'parametryzacja'],
      sections: ['Wymagania instalacyjne', 'Procedura montażu', 'Konfiguracja', 'FAQ'],
    },
    {
      topic: 'Kompensatory SVG w sieciach z dużą zawartością harmonicznych',
      keywords: ['harmoniczne', 'SVG', 'jakość energii', 'filtracja harmonicznych'],
      sections: ['Problem harmonicznych', 'Jak SVG eliminuje harmoniczne', 'Przykłady', 'FAQ'],
    },
    {
      topic: 'ROI z inwestycji w kompensator SVG - analiza zwrotu',
      keywords: ['ROI kompensator', 'zwrot z inwestycji', 'oszczędności SVG'],
      sections: ['Koszty inwestycji', 'Oszczędności', 'Okres zwrotu', 'Kalkulacja ROI', 'FAQ'],
    },
  ],
};

// Odoo client (simplified - use your full odoo-client.ts)
async function publishToOdoo(article: { title: string; content: string }): Promise<{ id: number }> {
  const odooUrl = process.env.ODOO_URL || 'https://powergo.pl';
  const odooApiKey = process.env.ODOO_API_KEY;
  const odooDb = process.env.ODOO_DB || 'odoo';
  const blogId = parseInt(process.env.ODOO_BLOG_ID || '2');

  if (!odooApiKey) {
    throw new Error('ODOO_API_KEY not configured');
  }

  // Create blog post via Odoo XML-RPC or REST API
  // This is a simplified version - use your full odoo-client.ts
  const response = await fetch(`${odooUrl}/api/blog.post/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${odooApiKey}`,
    },
    body: JSON.stringify({
      name: article.title,
      blog_id: blogId,
      content: article.content,
      is_published: false, // Draft - needs approval
    }),
  });

  if (!response.ok) {
    throw new Error(`Odoo API error: ${response.statusText}`);
  }

  return response.json();
}

// Get topic based on day of week
function getTopicForToday(): { outline: ArticleOutline; category: string } | null {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, 4 = Thursday

  let category: keyof typeof TOPICS;
  
  if (dayOfWeek === 1) {
    // Monday - kompensacja mocy biernej
    category = 'kompensacja_mocy_biernej';
  } else if (dayOfWeek === 4) {
    // Thursday - kompensatory SVG
    category = 'kompensatory_svg';
  } else {
    // Not a scheduled day
    return null;
  }

  const topics = TOPICS[category];
  // Rotate through topics based on week number
  const weekNumber = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
  const topicIndex = weekNumber % topics.length;
  const topic = topics[topicIndex];

  return {
    outline: {
      ...topic,
      targetLength: 1500,
      category,
    },
    category,
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Verify cron secret (Vercel sends this header)
  const cronSecret = req.headers['x-vercel-cron-signature'];
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    // Also allow manual trigger with API_SECRET
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.API_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    console.log('[Cron] Schedule triggered at', new Date().toISOString());

    // Get topic for today
    const topicData = getTopicForToday();
    
    if (!topicData) {
      console.log('[Cron] Not a scheduled publication day');
      return res.status(200).json({
        success: true,
        message: 'Not a scheduled publication day',
        nextRun: 'Monday or Thursday 9:00 CET',
      });
    }

    console.log(`[Cron] Generating article: ${topicData.outline.topic}`);

    // Get API config
    const config: AIConfig = {
      geminiApiKey: process.env.GEMINI_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    };

    // Generate articles
    const articles = await generateArticlesParallel(topicData.outline, config);
    const bestArticle = selectBestArticle(articles);

    console.log(`[Cron] Best article from ${bestArticle.writer}: ${bestArticle.wordCount} words`);

    // Publish to Odoo (as draft)
    let odooResult = null;
    try {
      odooResult = await publishToOdoo({
        title: bestArticle.title,
        content: bestArticle.content,
      });
      console.log(`[Cron] Published to Odoo as draft, ID: ${odooResult.id}`);
    } catch (odooError) {
      console.error('[Cron] Failed to publish to Odoo:', odooError);
      // Continue - article was generated successfully
    }

    // Send notification email (optional)
    // await sendNotificationEmail({ article: bestArticle, odooId: odooResult?.id });

    return res.status(200).json({
      success: true,
      article: {
        title: bestArticle.title,
        writer: bestArticle.writer,
        wordCount: bestArticle.wordCount,
        category: topicData.category,
      },
      odoo: odooResult ? { id: odooResult.id, status: 'draft' } : null,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Cron] Error:', error);
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Vercel config
export const config = {
  maxDuration: 120, // 2 minutes for generation + publishing
};
