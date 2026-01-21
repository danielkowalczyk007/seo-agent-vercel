/**
 * Vercel Serverless Function: Generate Article
 * POST /api/generate
 * 
 * Generates SEO-optimized articles using multiple AI models in parallel
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  generateArticlesParallel, 
  selectBestArticle,
  type ArticleOutline,
  type AIConfig 
} from '../lib/ai-writers';

// Environment validation
function getConfig(): AIConfig {
  return {
    geminiApiKey: process.env.GEMINI_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  };
}

// Validate request body
function validateOutline(body: unknown): ArticleOutline {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body is required');
  }

  const outline = body as Record<string, unknown>;

  if (!outline.topic || typeof outline.topic !== 'string') {
    throw new Error('topic is required and must be a string');
  }

  if (!Array.isArray(outline.keywords) || outline.keywords.length === 0) {
    throw new Error('keywords is required and must be a non-empty array');
  }

  return {
    topic: outline.topic,
    keywords: outline.keywords as string[],
    targetLength: typeof outline.targetLength === 'number' ? outline.targetLength : 1500,
    sections: Array.isArray(outline.sections) ? outline.sections as string[] : [],
    category: outline.category === 'kompensatory_svg' ? 'kompensatory_svg' : 'kompensacja_mocy_biernej',
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate API key (optional security layer)
    const authHeader = req.headers.authorization;
    if (process.env.API_SECRET && authHeader !== `Bearer ${process.env.API_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Parse and validate request
    const outline = validateOutline(req.body);
    const config = getConfig();

    // Check if any API keys are configured
    if (!config.geminiApiKey && !config.openaiApiKey && !config.anthropicApiKey) {
      return res.status(500).json({ 
        error: 'No AI API keys configured',
        details: 'Set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY environment variables'
      });
    }

    console.log(`[API] Generating article for: ${outline.topic}`);
    const startTime = Date.now();

    // Generate articles in parallel
    const articles = await generateArticlesParallel(outline, config);

    // Select best article
    const bestArticle = selectBestArticle(articles);

    const responseTime = Date.now() - startTime;
    console.log(`[API] Completed in ${responseTime}ms`);

    return res.status(200).json({
      success: true,
      article: bestArticle,
      alternatives: articles.filter(a => a.writer !== bestArticle.writer),
      metadata: {
        totalArticles: articles.length,
        selectedWriter: bestArticle.writer,
        responseTime,
      }
    });

  } catch (error) {
    console.error('[API] Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const statusCode = errorMessage.includes('required') ? 400 : 500;

    return res.status(statusCode).json({
      success: false,
      error: errorMessage,
    });
  }
}

// Vercel config for longer timeout (needed for AI generation)
export const config = {
  maxDuration: 60, // 60 seconds max (Pro plan allows up to 300s)
};
