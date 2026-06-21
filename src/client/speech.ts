export const MAX_AGENT_WORDS = 25;
export const MAX_AGENT_SENTENCES = 2;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Clamp council speech: max 2 sentences, max 25 words, hard stop at sentence end. */
export function clampAgentSpeech(text: string): string {
  return clampSpeech(text, MAX_AGENT_WORDS, MAX_AGENT_SENTENCES);
}

function clampSpeech(text: string, maxWords: number, maxSentences: number): string {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (!cleaned) return cleaned;

  const sentences =
    cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [cleaned];

  const kept: string[] = [];
  let totalWords = 0;

  for (const sentence of sentences) {
    if (kept.length >= maxSentences) break;

    const sentenceWords = countWords(sentence);
    if (totalWords + sentenceWords <= maxWords) {
      kept.push(sentence);
      totalWords += sentenceWords;
    } else {
      break;
    }
  }

  if (kept.length > 0) {
    return kept.join(' ');
  }

  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, maxWords);
  const fallback = words.join(' ').replace(/[,;:—-]+$/, '');
  return /[.!?]$/.test(fallback) ? fallback : `${fallback}.`;
}

export const JARVIS_MAX_WORDS = 20;

/** Jarvis: exactly 1 sentence, max 20 words, hard stop at sentence end. */
export function clampJarvisSpeech(text: string): string {
  return clampSpeech(text, JARVIS_MAX_WORDS, 1);
}
