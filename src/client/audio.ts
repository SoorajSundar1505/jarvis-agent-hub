let sfxCtx: AudioContext | null = null;

async function getSfxContext(): Promise<AudioContext> {
  if (!sfxCtx) sfxCtx = new AudioContext();
  if (sfxCtx.state === 'suspended') await sfxCtx.resume();
  return sfxCtx;
}

/** Short robot beeps for the "Passing to JARVIS" handoff. */
export async function playJarvisHandoffBeeps(): Promise<void> {
  try {
    const ctx = await getSfxContext();
    const t0 = ctx.currentTime;

    const pattern = [
      { freq: 920, at: 0, dur: 0.07 },
      { freq: 1180, at: 0.11, dur: 0.07 },
      { freq: 920, at: 0.55, dur: 0.07 },
      { freq: 1180, at: 0.66, dur: 0.07 },
      { freq: 920, at: 1.1, dur: 0.07 },
      { freq: 1400, at: 1.22, dur: 0.1 },
    ];

    pattern.forEach(({ freq, at, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + at);
      gain.gain.exponentialRampToValueAtTime(0.14, t0 + at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + dur + 0.03);
    });
  } catch {
    /* audio blocked or unavailable */
  }
}

const THEME_PATHS = ['/audio/avengers_endgame.mp3', '/audio/theme.mp3'];
const FADE_MS = 2000;

let themeAudio: HTMLAudioElement | null = null;
let themeReady = false;
let useFallback = false;
let musicEnabled = localStorage.getItem('jarvis_music') !== 'false';
let fallbackCtx: AudioContext | null = null;
let fallbackNodes: OscillatorNode[] = [];
let fallbackGain: GainNode | null = null;

export function isMusicEnabled(): boolean {
  return musicEnabled;
}

export function setMusicEnabled(enabled: boolean): void {
  musicEnabled = enabled;
  localStorage.setItem('jarvis_music', String(enabled));
  if (!enabled) stopTheme();
}

export async function initThemeAudio(): Promise<void> {
  for (const path of THEME_PATHS) {
    const audio = new Audio(path);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;

    const loaded = await new Promise<boolean>((resolve) => {
      audio.addEventListener('canplaythrough', () => resolve(true), { once: true });
      audio.addEventListener('error', () => resolve(false), { once: true });
      setTimeout(() => resolve(audio.readyState >= 2), 2000);
    });

    if (loaded) {
      themeAudio = audio;
      themeReady = true;
      useFallback = false;
      return;
    }
  }

  useFallback = true;
  themeReady = true;
}

export async function playTheme(): Promise<void> {
  if (!musicEnabled || !themeReady) return;

  if (useFallback || !themeAudio) {
    playCinematicFallback();
    return;
  }

  try {
    themeAudio.volume = 0;
    themeAudio.currentTime = 0;
    await themeAudio.play();
    fadeVolume(themeAudio, 0, 0.45, 1800);
  } catch {
    useFallback = true;
    playCinematicFallback();
  }
}

export function stopTheme(): void {
  stopCinematicFallback();

  if (!themeAudio || themeAudio.paused) return;
  fadeVolume(themeAudio, themeAudio.volume, 0, FADE_MS, () => {
    themeAudio?.pause();
  });
}

function playCinematicFallback(): void {
  stopCinematicFallback();

  fallbackCtx = new AudioContext();
  fallbackGain = fallbackCtx.createGain();
  fallbackGain.connect(fallbackCtx.destination);
  fallbackGain.gain.setValueAtTime(0, fallbackCtx.currentTime);
  fallbackGain.gain.linearRampToValueAtTime(0.18, fallbackCtx.currentTime + 1.5);

  const notes = [110, 146.83, 174.61, 220, 261.63];
  notes.forEach((freq, i) => {
    const osc = fallbackCtx!.createOscillator();
    const gain = fallbackCtx!.createGain();
    osc.type = i === 0 ? 'sine' : 'triangle';
    osc.frequency.value = freq;
    gain.gain.value = 0.12 / (i + 1);
    osc.connect(gain);
    gain.connect(fallbackGain!);
    osc.start(fallbackCtx!.currentTime + i * 0.15);
    fallbackNodes.push(osc);
  });

  const drone = fallbackCtx.createOscillator();
  drone.type = 'sine';
  drone.frequency.value = 55;
  const droneGain = fallbackCtx.createGain();
  droneGain.gain.value = 0.08;
  drone.connect(droneGain);
  droneGain.connect(fallbackGain);
  drone.start();
  fallbackNodes.push(drone);
}

function stopCinematicFallback(): void {
  fallbackNodes.forEach((n) => {
    try {
      n.stop();
    } catch {
      /* already stopped */
    }
  });
  fallbackNodes = [];
  fallbackGain = null;
  if (fallbackCtx) {
    fallbackCtx.close().catch(() => {});
    fallbackCtx = null;
  }
}

function fadeVolume(
  audio: HTMLAudioElement,
  from: number,
  to: number,
  duration: number,
  onComplete?: () => void
): void {
  const start = performance.now();

  function step(now: number): void {
    const t = Math.min((now - start) / duration, 1);
    audio.volume = from + (to - from) * t;
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      onComplete?.();
    }
  }

  requestAnimationFrame(step);
}
