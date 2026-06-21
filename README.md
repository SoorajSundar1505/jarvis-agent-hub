# J.A.R.V.I.S. — Agent Council

A cinematic single-page web app where three AI council agents debate your question, then **JARVIS** delivers a final verdict — Iron Man HUD style. Trigger the protocol with a button click, by clapping twice, or by saying **"Agents assemble"**.

## Council flow

```
Prompt → Natasha → Thor → Pepper → [pause] → JARVIS
```

| Agent | Role | Voice | Slot |
|-------|------|-------|------|
| 🔴 **Natasha** | Route Instinct | Female | 7s |
| 🟢 **Thor** | Epic Routes | Male | 7s |
| 🔵 **Pepper** | Travel Logistics | Female | 7s |
| ⚡ **JARVIS** | Travel Verdict | Male | 7s |

**Council target: ~40 seconds total** (4 × 7s speaking slots + short transitions). API responses are prefetched during each speaker's slot to stay on pace.

- **Debaters:** 1–2 sentences, max 25 words each — travel routes, stops, logistics
- **JARVIS:** 1 sentence, max 20 words — final travel verdict on the center card

## UI highlights

- **Single-screen layout** — no scroll; three agents fit in one row during debate
- **JARVIS replaces the council** — after the three agents finish, they fade out and JARVIS appears centered in the same spot
- **Iron Man mask** — helmet animates above the JARVIS card while he speaks (text stays readable below)
- **Marvel HUD** — scanlines, animated grid, arc reactor, hexagonal agent cards, debate dimming
- **Personalization** — operator name and title configured in `src/client/agents.ts`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create your env file:

```bash
cp .env.example .env
```

3. Add your [OpenAI API key](https://platform.openai.com/api-keys) to `.env`:

```
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini
PORT=8765
```

4. Build the client (required on first clone — `public/app.js` is gitignored):

```bash
npm run build
```

5. Start the dev server:

```bash
npm run dev
```

6. Open **http://localhost:8765** in Chrome (best for mic + speech).

## Optional theme music

Drop an MP3 into `public/audio/`:

```
public/audio/avengers_endgame.mp3
public/audio/theme.mp3   # fallback path
```

Music plays when the council starts (button, clap, or voice trigger) and fades out at the end. If no file is present, a cinematic synth fallback plays. Toggle with the **THEME** button in the footer.

## Triggers

| Method | How |
|--------|-----|
| **Button** | Click **INITIATE COUNCIL** or press Enter |
| **Clap** | Click the mic button to enable, then clap twice (or one loud clap) |
| **Voice** | Say *"Agents assemble"* or *"Avengers assemble"* |

## Personalization

Edit `src/client/agents.ts`:

```typescript
export const USER_NAME = 'Suraj';
export const USER_HONORIFIC = 'Commander';
```

The header, JARVIS card, footer, and AI prompts all use these values.

## Tech

- **Backend:** Node.js + Express + TypeScript + OpenAI SDK
- **Frontend:** TypeScript (bundled with esbuild)
- **AI:** OpenAI `gpt-4o-mini` (configurable via `OPENAI_MODEL`)
- **Voice:** Web Speech API (gender-matched voices)
- **Clap detection:** Web Audio API time-domain peak/RMS
- **Voice trigger:** Web Speech Recognition

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start server + watch client TS |
| `npm run build` | Build client bundle + compile server |
| `npm start` | Run production server |

## Project structure

```
src/
  server.ts              Express server + OpenAI proxy
  client/
    app.ts               Council sequence engine
    agents.ts            Agent configs, USER_NAME, triggers
    speech.ts            Word/sentence clamping for TTS
    triggers.ts          Clap + voice command detection
    audio.ts             Theme music + synth fallback
    types.ts             Shared types
public/
  index.html             HUD UI
  styles.css             Iron Man theme
  app.js                 Bundled client (generated — run npm run build)
  audio/                 Theme MP3s (not committed)
.env.example
```

## Production

```bash
npm run build
npm start
```

Your OpenAI key stays server-side in `.env` — never exposed to the browser.
