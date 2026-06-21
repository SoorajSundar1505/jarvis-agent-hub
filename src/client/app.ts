import {
  AGENT_SLOT_MS,
  AGENT_SLOT_SEC,
  BOOT_MESSAGES,
  COUNCIL_ORDER,
  DEBATERS,
  DEBATER_MAX_TOKENS,
  getAgent,
  JARVIS,
  JARVIS_MAX_TOKENS,
  JARVIS_PAUSE_MS,
  JARVIS_SLOT_MS,
  USER_NAME,
  USER_HONORIFIC,
} from './agents.js';
import {
  initThemeAudio,
  isMusicEnabled,
  playJarvisHandoffBeeps,
  playTheme,
  setMusicEnabled,
  stopTheme,
} from './audio.js';
import {
  clampAgentSpeech,
  clampJarvisSpeech,
  countWords,
} from './speech.js';
import { initTriggers, resumeAudio } from './triggers.js';
import type { Agent, ApiError, ChatResponse, DebateLine, VoiceConfig } from './types.js';

const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel)!;
const $$ = <T extends Element>(sel: string) => document.querySelectorAll<T>(sel);

let isRunning = false;
let councilTranscript: DebateLine[] = [];

const userPrompt = $<HTMLTextAreaElement>('#userPrompt');
const initiateBtn = $<HTMLButtonElement>('#initiateBtn');
const footerStatus = $<HTMLElement>('#footerStatus');
const promptSection = $<HTMLElement>('#promptSection');
const sequenceOverlay = $<HTMLElement>('#sequenceOverlay');
const overlayText = $<HTMLElement>('#overlayText');
const clock = $<HTMLElement>('#clock');
const musicToggle = $<HTMLButtonElement>('#musicToggle');
const councilStage = $<HTMLElement>('#councilStage');
const jarvisMaskStage = $<HTMLElement>('#jarvisMaskStage');

function showJarvisMask(): void {
  jarvisMaskStage.classList.add('visible');
  document.body.classList.add('jarvis-speaking');
}

function hideJarvisMask(): void {
  jarvisMaskStage.classList.remove('visible');
  document.body.classList.remove('jarvis-speaking');
}

function init(): void {
  void initThemeAudio();

  const titleSub = document.querySelector<HTMLElement>('#titleSub');
  const operatorTag = document.querySelector<HTMLElement>('#operatorTag');
  if (titleSub) {
    titleSub.textContent = `Council Protocol · ${USER_HONORIFIC} ${USER_NAME}`;
  }
  if (operatorTag) {
    operatorTag.textContent = `${USER_HONORIFIC} · ${USER_NAME.toUpperCase()}`;
  }
  footerStatus.textContent = `AWAITING PLAN — ${USER_NAME.toUpperCase()}`;

  DEBATERS.forEach((agent) => {
    const card = getCard(agent.id);
    card.querySelector('.agent-role')!.textContent = agent.role;
    card.querySelector('.slot-label')!.textContent = `${AGENT_SLOT_SEC}s`;
  });
  getCard('jarvis').querySelector('.agent-role')!.textContent = JARVIS.role;
  getCard('jarvis').querySelector('.slot-label')!.textContent = `${AGENT_SLOT_SEC}s`;

  musicToggle.classList.toggle('off', !isMusicEnabled());
  musicToggle.setAttribute('aria-pressed', String(isMusicEnabled()));

  musicToggle.addEventListener('click', () => {
    const next = !isMusicEnabled();
    setMusicEnabled(next);
    musicToggle.classList.toggle('off', !next);
    musicToggle.setAttribute('aria-pressed', String(next));
  });

  initiateBtn.addEventListener('click', () => {
    if (!isRunning) void triggerSequence();
  });

  userPrompt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isRunning) void triggerSequence();
    }
  });

  loadVoices();
  updateClock();
  setInterval(updateClock, 1000);

  initTriggers(() => void triggerSequence(), () => !isRunning);
}

function loadVoices(): void {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

function updateClock(): void {
  clock.textContent = new Date().toTimeString().slice(0, 8);
}

function setFooterStatus(text: string, active = false): void {
  footerStatus.textContent = text;
  footerStatus.classList.toggle('active', active);
}

function showOverlay(text: string, duration = 1500): Promise<void> {
  return new Promise((resolve) => {
    overlayText.textContent = text;
    sequenceOverlay.classList.add('visible');
    setTimeout(() => {
      sequenceOverlay.classList.remove('visible');
      setTimeout(resolve, 400);
    }, duration);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureAudioContext(): Promise<void> {
  await resumeAudio();
}

async function callOpenAI(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemPrompt, userMessage, maxTokens }),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as ApiError;
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  const data = (await response.json()) as ChatResponse;
  return data.content;
}

function pickVoice(voiceConfig: VoiceConfig): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'));
  if (!voices.length) return null;

  const femaleNames = /samantha|victoria|karen|zira|fiona|moira|susan|female|google uk english female|google us english female|nicky/i;
  const maleNames = /daniel|alex|david|james|fred|tom|male|google uk english male|google us english male|aaron|rishi/i;

  if (voiceConfig.gender === 'female') {
    return voices.find((v) => femaleNames.test(v.name)) ?? null;
  }
  return voices.find((v) => maleNames.test(v.name)) ?? null;
}

/** Speaks full text — never cuts mid-sentence. */
function speak(text: string, voiceConfig: VoiceConfig): Promise<void> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = voiceConfig.rate;
    utterance.pitch = voiceConfig.pitch;
    utterance.volume = 1;

    const voice = pickVoice(voiceConfig);
    if (voice) utterance.voice = voice;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

function getCard(agentId: string): HTMLElement {
  return $(`#agent-${agentId}`);
}

function setBadge(card: HTMLElement, text: string): void {
  card.querySelector('.status-badge')!.textContent = text;
}

function resetCards(): void {
  councilStage.classList.remove('jarvis-phase');
  $$<HTMLElement>('.agent-card').forEach((card) => {
    const agent = card.dataset.agent!;
    card.className = agent === 'jarvis' ? 'agent-card jarvis-card' : 'agent-card';
    card.querySelector('.agent-response')!.textContent = '';
    setBadge(card, agent === 'jarvis' ? 'STANDBY' : 'OFFLINE');
  });
}

function setCouncilLighting(activeId: string): void {
  $$<HTMLElement>('#debateGrid .agent-card').forEach((card) => {
    const id = card.dataset.agent!;
    card.classList.remove('speaking', 'active');

    if (id === activeId) {
      card.classList.remove('dimmed');
      card.classList.add('visible', 'speaking', 'active');
    } else if (card.classList.contains('visible')) {
      card.classList.add('dimmed');
    }
  });
}

function buildTranscriptText(): string {
  return councilTranscript.map((line) => `${line.name}: "${line.text}"`).join('\n');
}

function buildTurnPrompt(agent: Agent, plan: string): string {
  const transcript = buildTranscriptText();
  const onPlan = `Stay focused on this travel plan — routes, transport, stays, and destinations only.`;

  if (agent.id === 'natasha') {
    return `${USER_NAME}'s travel plan:\n"${plan}"\n\nYou speak first. One short travel opinion on this plan for ${USER_NAME}. ${onPlan} Max 2 sentences, 25 words.`;
  }

  return `${USER_NAME}'s travel plan:\n"${plan}"\n\nCouncil opinions so far:\n${transcript}\n\nYour turn — one short travel opinion on this plan for ${USER_NAME}. ${onPlan} Max 2 sentences, 25 words.`;
}

function runSlotTimer(card: HTMLElement, durationMs = AGENT_SLOT_MS): Promise<void> {
  const fill = card.querySelector('.slot-fill') as HTMLElement | null;
  const label = card.querySelector('.slot-label') as HTMLElement | null;
  if (!fill || !label) return delay(AGENT_SLOT_MS);

  fill.style.transition = 'none';
  fill.style.width = '100%';
  label.textContent = `${Math.ceil(durationMs / 1000)}s`;
  void fill.offsetWidth;
  fill.style.transition = `width ${durationMs}ms linear`;
  fill.style.width = '0%';

  const start = Date.now();
  const interval = setInterval(() => {
    const left = Math.max(0, Math.ceil((durationMs - (Date.now() - start)) / 1000));
    label.textContent = `${left}s`;
  }, 250);

  return delay(durationMs).then(() => clearInterval(interval));
}

async function fetchCouncilResponse(agent: Agent, plan: string): Promise<string> {
  try {
    const raw = await callOpenAI(agent.systemPrompt, buildTurnPrompt(agent, plan), DEBATER_MAX_TOKENS);
    return clampAgentSpeech(raw);
  } catch (err) {
    return `Systems offline. ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

async function fetchJarvisResponse(plan: string): Promise<string> {
  const userMessage = `${USER_NAME}'s travel plan:\n"${plan}"\n\nCouncil opinions:\n${buildTranscriptText()}\n\nOne sentence, max 20 words — final travel verdict that approves or refines this route for ${USER_NAME}.`;
  try {
    const raw = await callOpenAI(JARVIS.systemPrompt, userMessage, JARVIS_MAX_TOKENS);
    return clampJarvisSpeech(raw);
  } catch (err) {
    return `Systems offline. ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

async function runCouncilTurn(agent: Agent, response: string): Promise<void> {
  const card = getCard(agent.id);
  const responseEl = card.querySelector('.agent-response') as HTMLElement;

  if (!card.classList.contains('visible')) {
    card.classList.add('visible');
    await delay(100);
  }

  setCouncilLighting(agent.id);
  setFooterStatus(`${agent.name.toUpperCase()} — ${AGENT_SLOT_SEC} SEC`, true);
  setBadge(card, 'SPEAKING');

  responseEl.textContent = response;
  setFooterStatus(`${agent.name.toUpperCase()} — ${countWords(response)} WORDS`, true);

  const timerPromise = runSlotTimer(card);
  await speak(response, agent.voice);
  await timerPromise;

  setBadge(card, 'COMPLETE');
  card.classList.remove('speaking', 'active');
  card.classList.add('dimmed');
  await delay(100);
}

async function bootJarvis(): Promise<void> {
  const card = getCard('jarvis');
  const bootLine = card.querySelector('.boot-line')!;
  const msgs = BOOT_MESSAGES.jarvis;

  card.classList.add('visible', 'booting', 'jarvis-awakening');
  setBadge(card, 'AWAKENING');

  for (const msg of msgs.slice(0, -1)) {
    bootLine.textContent = msg;
    await delay(350);
  }

  bootLine.textContent = msgs[msgs.length - 1];
  await delay(400);

  card.classList.remove('booting');
  card.classList.add('active');
  setBadge(card, 'ONLINE');
  await delay(250);
}

async function runJarvis(plan: string, prefetched?: Promise<string>): Promise<void> {
  const card = getCard('jarvis');
  const responseEl = card.querySelector('.agent-response') as HTMLElement;

  councilStage.classList.add('jarvis-phase');
  await delay(250);

  await bootJarvis();

  setFooterStatus('JARVIS — FINAL VERDICT', true);
  setBadge(card, 'SYNTHESIZING');

  const response = prefetched ? await prefetched : await fetchJarvisResponse(plan);

  setBadge(card, 'TRANSMITTING');
  responseEl.textContent = response;
  setFooterStatus(`JARVIS — ${countWords(response)} WORDS · ${AGENT_SLOT_SEC} SEC`, true);

  card.classList.add('speaking');
  showJarvisMask();
  try {
    const timerPromise = runSlotTimer(card, JARVIS_SLOT_MS);
    await speak(response, JARVIS.voice);
    await timerPromise;
  } finally {
    hideJarvisMask();
  }

  card.classList.remove('speaking');
  card.classList.add('done');
  setBadge(card, 'VERDICT DELIVERED');
}

function hideVerdict(): void {
  /* verdict lives in the Jarvis card */
}

async function triggerSequence(): Promise<void> {
  if (isRunning) return;

  const plan = userPrompt.value.trim();
  if (!plan) {
    userPrompt.focus();
    userPrompt.style.borderColor = 'var(--natasha)';
    setTimeout(() => { userPrompt.style.borderColor = ''; }, 1500);
    return;
  }

  isRunning = true;
  await ensureAudioContext();
  councilTranscript = [];
  hideVerdict();

  void playTheme();

  initiateBtn.disabled = true;
  document.body.classList.add('sequence-running');
  councilStage.classList.add('debate-active');
  promptSection.classList.add('dimmed');
  setFooterStatus('PLAN UNDER REVIEW', true);
  resetCards();

  await showOverlay('PLAN RECEIVED', 600);
  await delay(150);
  await showOverlay('NATASHA · THOR · PEPPER', 500);

  let nextFetch = fetchCouncilResponse(getAgent(COUNCIL_ORDER[0]), plan);
  let jarvisFetch: Promise<string> | null = null;

  for (let i = 0; i < COUNCIL_ORDER.length; i++) {
    const agentId = COUNCIL_ORDER[i];
    const agent = getAgent(agentId);
    const response = await nextFetch;
    councilTranscript.push({ agentId: agent.id, name: agent.name, text: response });

    if (i + 1 < COUNCIL_ORDER.length) {
      nextFetch = fetchCouncilResponse(getAgent(COUNCIL_ORDER[i + 1]), plan);
    } else {
      jarvisFetch = fetchJarvisResponse(plan);
    }

    await runCouncilTurn(agent, response);
  }

  setFooterStatus('COUNCIL COMPLETE', true);
  await delay(150);
  void playJarvisHandoffBeeps();
  await showOverlay('PASSING TO JARVIS...', JARVIS_PAUSE_MS);

  await runJarvis(plan, jarvisFetch ?? fetchJarvisResponse(plan));

  await showOverlay('PROTOCOL COMPLETE', 1000);

  stopTheme();
  setFooterStatus('PROTOCOL COMPLETE');
  promptSection.classList.remove('dimmed');
  councilStage.classList.remove('debate-active');
  initiateBtn.disabled = false;
  document.body.classList.remove('sequence-running');
  isRunning = false;
}

init();
