import {
  CLAP_COOLDOWN_MS,
  CLAP_PEAK_MIN,
  CLAP_RMS_MIN,
  CLAP_RMS_RATIO,
  CLAP_WINDOW_MS,
  CLAPS_REQUIRED,
} from './agents.js';

type TriggerCallback = () => void;

let onTrigger: TriggerCallback | null = null;
let isListening = false;
let canRun = () => true;

let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let micStream: MediaStream | null = null;
let clapCount = 0;
let lastClapTime = 0;
let clapWindowStart = 0;
let clapLoopStarted = false;
let clapReady = false;
let clapReadyAt = 0;

const VOICE_AFTER_CLAP_MS = 10000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRecognitionCtor: (new () => SpeechRecognition) | undefined =
  typeof window !== 'undefined'
    ? window.SpeechRecognition ?? (window as any).webkitSpeechRecognition
    : undefined;

let recognition: SpeechRecognition | null = null;

const micStatus = () => document.querySelector<HTMLElement>('#micStatus')!;
const micLabel = () => document.querySelector<HTMLElement>('#micLabel')!;
const micLevelFill = () => document.querySelector<HTMLElement>('#micLevelFill')!;

const ASSEMBLE_PATTERNS = [
  /agents?\s*assemble/,
  /assemble\s*agents?/,
  /avengers?\s*assemble/,
  /agent\s*assembly/,
];

export function initTriggers(trigger: TriggerCallback, running: () => boolean): void {
  onTrigger = trigger;
  canRun = running;

  const micEl = micStatus();
  micEl.style.cursor = 'pointer';
  micEl.title = 'Click to enable microphone — clap, then say Agents assemble';
  micEl.addEventListener('click', () => void enableListening());
}

function idleMicLabel(): string {
  return 'CLAP — THEN SAY "AGENTS ASSEMBLE"';
}

function resetArming(): void {
  clapReady = false;
  clapReadyAt = 0;
  clapCount = 0;
}

function armAfterClap(): void {
  if (!canRun()) return;

  clapReady = true;
  clapReadyAt = Date.now();
  micLabel().textContent = 'CLAP OK — NOW SAY "AGENTS ASSEMBLE"';
  micStatus().classList.add('clap-detected');
  setTimeout(() => micStatus().classList.remove('clap-detected'), 400);
}

function tryCompleteTrigger(): void {
  if (!canRun() || !onTrigger || !clapReady) return;

  if (Date.now() - clapReadyAt > VOICE_AFTER_CLAP_MS) {
    resetArming();
    micLabel().textContent = 'TOO SLOW — CLAP AGAIN, THEN SAY "AGENTS ASSEMBLE"';
    return;
  }

  resetArming();
  fireTrigger('AGENTS ASSEMBLE!');
}

export async function enableListening(): Promise<void> {
  if (isListening) return;

  try {
    await startClapDetection();
    startVoiceCommand();
    isListening = true;
    micStatus().classList.add('listening');
    micLabel().textContent = idleMicLabel();
  } catch {
    micLabel().textContent = 'MIC BLOCKED — CLICK & ALLOW ACCESS';
  }
}

async function startClapDetection(): Promise<void> {
  if (!micStream) {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
  }

  if (!audioContext) audioContext = new AudioContext();
  await audioContext.resume();

  if (!analyser) {
    const source = audioContext.createMediaStreamSource(micStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.02;
    source.connect(analyser);
  }

  if (!clapLoopStarted) {
    clapLoopStarted = true;
    runClapLoop();
  }
}

function runClapLoop(): void {
  if (!analyser) return;

  const data = new Uint8Array(analyser.fftSize);
  let baseline = 0.015;
  let calibrated = false;
  let samples = 0;

  function tick(): void {
    if (!analyser) return;
    requestAnimationFrame(tick);

    let sum = 0;
    let peak = 0;
    analyser.getByteTimeDomainData(data);
    for (let i = 0; i < data.length; i++) {
      const amp = Math.abs((data[i] - 128) / 128);
      sum += amp * amp;
      if (amp > peak) peak = amp;
    }
    const rms = Math.sqrt(sum / data.length);

    micLevelFill().style.width = `${Math.min(100, peak * 250)}%`;

    if (!calibrated) {
      baseline = (baseline * samples + rms) / (samples + 1);
      samples++;
      if (samples >= 45) calibrated = true;
      return;
    }

    const ratio = rms / (baseline + 0.005);
    const loudClap = peak >= 0.45 && rms >= 0.06;
    const normalClap =
      peak >= CLAP_PEAK_MIN && rms >= CLAP_RMS_MIN && ratio >= CLAP_RMS_RATIO;

    if (loudClap || normalClap) {
      handleClap(loudClap);
    } else {
      baseline = baseline * 0.94 + rms * 0.06;
      if (clapReady && Date.now() - clapReadyAt > VOICE_AFTER_CLAP_MS) {
        resetArming();
        micLabel().textContent = 'VOICE WINDOW EXPIRED — CLAP AGAIN';
      }
    }
  }

  tick();
}

function handleClap(isLoud: boolean): void {
  const now = Date.now();
  if (now - lastClapTime < CLAP_COOLDOWN_MS) return;
  lastClapTime = now;

  if (isLoud) {
    armAfterClap();
    return;
  }

  if (now - clapWindowStart > CLAP_WINDOW_MS) clapCount = 0;
  if (clapCount === 0) clapWindowStart = now;
  clapCount++;

  micStatus().classList.add('clap-detected');
  setTimeout(() => micStatus().classList.remove('clap-detected'), 300);

  if (clapCount >= CLAPS_REQUIRED) {
    clapCount = 0;
    armAfterClap();
  } else {
    micLabel().textContent = `CLAP ${clapCount}/${CLAPS_REQUIRED} — THEN SAY "AGENTS ASSEMBLE"`;
  }
}

function startVoiceCommand(): void {
  if (!SpeechRecognitionCtor) {
    micLabel().textContent = 'CLAP TWICE — VOICE CMD NOT SUPPORTED IN THIS BROWSER';
    return;
  }

  recognition = new SpeechRecognitionCtor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text = event.results[i][0].transcript.toLowerCase().trim();
      if (ASSEMBLE_PATTERNS.some((p) => p.test(text))) {
        if (!clapReady) {
          micLabel().textContent = 'CLAP FIRST — THEN SAY "AGENTS ASSEMBLE"';
          return;
        }
        tryCompleteTrigger();
        return;
      }
    }
  };

  recognition.onend = () => {
    if (isListening && canRun()) {
      try {
        recognition?.start();
      } catch {
        /* already started */
      }
    }
  };

  recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
    if (e.error === 'not-allowed') {
      micLabel().textContent = 'MIC BLOCKED — ALLOW IN BROWSER SETTINGS';
      isListening = false;
    }
  };

  try {
    recognition.start();
  } catch {
    /* ignore */
  }
}

function fireTrigger(label: string): void {
  if (!canRun() || !onTrigger) return;

  resetArming();
  micLabel().textContent = label;
  micStatus().classList.add('clap-detected');
  document.body.classList.add('clap-triggered');
  setTimeout(() => {
    micStatus().classList.remove('clap-detected');
    document.body.classList.remove('clap-triggered');
  }, 600);

  onTrigger();

  setTimeout(() => {
    if (isListening && canRun()) micLabel().textContent = idleMicLabel();
  }, 1200);
}

export async function resumeAudio(): Promise<void> {
  if (audioContext?.state === 'suspended') await audioContext.resume();
  if (!isListening) await enableListening();
}
