import type { Agent } from './types.js';

export const USER_NAME = 'Suraj';
export const USER_HONORIFIC = 'Commander';

export const AGENT_SLOT_MS = 7000;
export const JARVIS_SLOT_MS = 7000;
export const JARVIS_PAUSE_MS = 1000;
export const COUNCIL_MAX_MS = 40000;
export const AGENT_SLOT_SEC = AGENT_SLOT_MS / 1000;
export const DEBATER_MAX_TOKENS = 60;
export const JARVIS_MAX_TOKENS = 50;

const SHORT_RULE = `CRITICAL: Exactly 1-2 sentences. Maximum 25 words total. One short travel opinion on ${USER_NAME}'s trip plan — routes, countries, transport, stays, food, or timing. Address ${USER_NAME} by name if natural. Complete sentences only — stop immediately after the last sentence. No bullet points, labels, or preamble. Stay on their travel plan only.`;

export const DEBATERS: Agent[] = [
  {
    id: 'natasha',
    name: 'Natasha',
    emoji: '🔴',
    role: 'Route Instinct',
    systemPrompt: `You are NATASHA, travel council advisor to ${USER_NAME}. Review their trip plan — one sharp take on destinations, local vibe, hidden spots, and what feels right on the route. ${SHORT_RULE}`,
    voice: { rate: 0.98, pitch: 1.12, gender: 'female' },
  },
  {
    id: 'thor',
    name: 'Thor',
    emoji: '🟢',
    role: 'Epic Routes',
    systemPrompt: `You are THOR, travel council advisor to ${USER_NAME}. Review their trip plan — one bold take on adventurous routes, scenic detours, and unforgettable stops worth the journey. ${SHORT_RULE}`,
    voice: { rate: 0.94, pitch: 0.88, gender: 'male' },
  },
  {
    id: 'pepper',
    name: 'Pepper',
    emoji: '🔵',
    role: 'Travel Logistics',
    systemPrompt: `You are PEPPER, travel council advisor to ${USER_NAME}. Review their trip plan — one practical take on trains, flights, budget, bookings, pacing, and day-to-day itinerary. ${SHORT_RULE}`,
    voice: { rate: 0.96, pitch: 1.08, gender: 'female' },
  },
];

export const JARVIS: Agent = {
  id: 'jarvis',
  name: 'JARVIS',
  emoji: '⚡',
  role: 'Travel Verdict',
  systemPrompt: `You are JARVIS, ${USER_NAME}'s travel AI. Natasha, Thor, and Pepper reviewed ${USER_NAME}'s trip plan. Give ONE sentence only — maximum 20 words. Approve or refine the route — address ${USER_NAME} by name. Complete the sentence and stop. No bullet points. ${SHORT_RULE}`,
  voice: { rate: 0.72, pitch: 0.75, gender: 'male' },
  isFinal: true,
};

export const COUNCIL_ORDER: Agent['id'][] = ['natasha', 'thor', 'pepper'];

export const BOOT_MESSAGES: Record<string, string[]> = {
  natasha: ['SCOUTING ROUTES...', 'READING THE MAP...', 'ONLINE'],
  thor: ['CHARTING ADVENTURE...', 'FINDING EPIC STOPS...', 'ONLINE'],
  pepper: ['MAPPING ITINERARY...', 'CHECKING LOGISTICS...', 'ONLINE'],
  jarvis: ['CONSOLIDATING ROUTES...', 'PREPARING VERDICT...', 'ONLINE'],
};

export const CLAP_PEAK_MIN = 0.12;
export const CLAP_RMS_RATIO = 1.25;
export const CLAP_RMS_MIN = 0.04;
export const CLAP_COOLDOWN_MS = 350;
export const CLAP_WINDOW_MS = 1400;
export const CLAPS_REQUIRED = 2;

export function getAgent(id: string): Agent {
  if (id === 'jarvis') return JARVIS;
  const agent = DEBATERS.find((a) => a.id === id);
  if (!agent) throw new Error(`Unknown agent: ${id}`);
  return agent;
}
