# SEO Agent dla PowerGO - Vercel Version

🚀 **Zmigrowana wersja z Manus na Vercel** - oszczędność ~98% kosztów!

## Porównanie kosztów

| Składnik | Manus | Vercel | Oszczędność |
|----------|-------|--------|-------------|
| Hosting | $50-150/msc | $0 | 100% |
| LLM API | ~$0.60 | ~$0.56 | 7% |
| **RAZEM** | **$50-151** | **~$1** | **98-99%** |

## Szybki start

### 1. Sklonuj i zainstaluj

```bash
git clone <this-repo>
cd seo-agent-vercel
npm install
```

### 2. Skonfiguruj zmienne środowiskowe

```bash
cp .env.example .env.local
# Edytuj .env.local i dodaj klucze API
```

### 3. Deploy na Vercel

```bash
# Zaloguj się do Vercel
npx vercel login

# Deploy preview
npx vercel

# Deploy produkcja
npx vercel --prod
```

### 4. Dodaj zmienne środowiskowe w Vercel Dashboard

1. Przejdź do https://vercel.com/dashboard
2. Wybierz projekt
3. Settings → Environment Variables
4. Dodaj wszystkie zmienne z `.env.example`

## Struktura projektu

```
seo-agent-vercel/
├── api/
│   ├── generate.ts      # POST /api/generate - generuje artykuł
│   └── schedule.ts      # GET /api/schedule - cron handler
├── lib/
│   └── ai-writers.ts    # Moduł AI writers (Gemini, GPT, Claude)
├── vercel.json          # Konfiguracja Vercel + Cron
├── package.json
├── tsconfig.json
└── .env.example
```

## API Endpoints

### POST /api/generate

Generuje artykuł SEO na żądanie.

**Request:**
```json
{
  "topic": "Kompensacja mocy biernej - podstawy",
  "keywords": ["kompensacja", "moc bierna", "cosφ"],
  "targetLength": 1500,
  "sections": ["Wstęp", "Zasada działania", "Korzyści", "FAQ"],
  "category": "kompensacja_mocy_biernej"
}
```

**Response:**
```json
{
  "success": true,
  "article": {
    "title": "...",
    "content": "<h2>...</h2><p>...</p>",
    "writer": "claude",
    "wordCount": 1523
  },
  "alternatives": [...],
  "metadata": {
    "totalArticles": 3,
    "responseTime": 45000
  }
}
```

### GET /api/schedule

Cron job - automatycznie triggerowany przez Vercel:
- **Poniedziałek 9:00 CET**: kompensacja mocy biernej
- **Czwartek 9:00 CET**: kompensatory SVG

## Kluczowe zmiany vs Manus

### 1. Usunięto OpenRouter

```typescript
// PRZED (Manus)
const client = new OpenAI({
  apiKey,
  baseURL: 'https://openrouter.ai/api/v1',
});
model: 'openai/gpt-4o-mini'

// PO (Vercel)
const client = new OpenAI({ apiKey });
model: 'gpt-4o-mini'
```

### 2. Vercel Serverless Functions

Każdy endpoint to osobna funkcja serverless z auto-skalowaniem.

### 3. Vercel Cron Jobs

Natywne crony Vercel zamiast zewnętrznego schedulera.

## Konfiguracja modeli AI

### Minimalna (najtańsza ~$0.03/msc)
Tylko Gemini + GPT-4o-mini:
```env
GEMINI_API_KEY=...
OPENAI_API_KEY=...
# ANTHROPIC_API_KEY= (puste)
```

### Rekomendowana (~$0.56/msc)
Wszystkie 3 modele:
```env
GEMINI_API_KEY=...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
```

### Premium (tylko Claude ~$0.53/msc)
Najwyższa jakość:
```env
# GEMINI_API_KEY= (puste)
# OPENAI_API_KEY= (puste)
ANTHROPIC_API_KEY=...
```

## Testowanie lokalne

```bash
# Uruchom lokalny serwer dev
npm run dev

# Test generowania artykułu
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Test kompensacji mocy biernej",
    "keywords": ["test", "kompensacja"],
    "targetLength": 500,
    "category": "kompensacja_mocy_biernej"
  }'

# Test cron job (ręczny trigger)
curl http://localhost:3000/api/schedule
```

## Monitorowanie

### Vercel Dashboard
- Logs: https://vercel.com/dashboard → projekt → Logs
- Analytics: https://vercel.com/dashboard → projekt → Analytics
- Cron: https://vercel.com/dashboard → projekt → Cron Jobs

### Logi
Wszystkie operacje logowane są do konsoli:
```
[AI Writers] Starting parallel generation for: ...
[Gemini] Completed in 12345ms, 1523 words
[ChatGPT] Completed in 15432ms, 1487 words
[Claude] Completed in 18765ms, 1612 words
[API] Completed in 45000ms
```

## Troubleshooting

### "No API keys configured"
Sprawdź czy dodałeś zmienne środowiskowe w Vercel Dashboard.

### Timeout errors
Zwiększ `maxDuration` w `vercel.json` (wymaga Pro plan dla >10s).

### Odoo connection failed
Sprawdź `ODOO_URL` i `ODOO_API_KEY`. Upewnij się że API Odoo jest dostępne.

## Migracja danych z Manus

Jeśli masz istniejące tematy w bazie Manus:
1. Wyeksportuj tematy do JSON
2. Dodaj do tablicy `TOPICS` w `api/schedule.ts`

## Licencja

Proprietary - PowerGO Sp. z o.o.
