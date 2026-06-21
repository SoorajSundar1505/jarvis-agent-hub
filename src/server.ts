import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 8765;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hasKey: Boolean(process.env.OPENAI_API_KEY) });
});

app.post('/api/chat', async (req, res) => {
  if (!openai) {
    res.status(500).json({
      error: { message: 'OPENAI_API_KEY not set — add it to your .env file' },
    });
    return;
  }

  const { systemPrompt, userMessage, maxTokens } = req.body as {
    systemPrompt?: string;
    userMessage?: string;
    maxTokens?: number;
  };

  if (!systemPrompt || !userMessage) {
    res.status(400).json({ error: { message: 'systemPrompt and userMessage are required' } });
    return;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: maxTokens ?? 400,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? '';
    res.json({ content });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'OpenAI request failed';
    res.status(500).json({ error: { message } });
  }
});

const server = app.listen(PORT, () => {
  console.log(`JARVIS → http://localhost:${PORT}`);
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠  OPENAI_API_KEY missing — copy .env.example to .env and add your key');
  }
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n⚠  Port ${PORT} is already in use. Kill the old process:\n   lsof -ti:${PORT} | xargs kill -9\n`);
    process.exit(1);
  }
  throw err;
});
