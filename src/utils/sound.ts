// Web Audio API synthesized feedback sounds (no external audio assets required)

const SOUND_PREF_KEY = 'abyssinia_sound_enabled';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const saved = window.localStorage.getItem(SOUND_PREF_KEY);
    return saved === null ? true : saved === 'true';
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SOUND_PREF_KEY, String(enabled));
  } catch {
    // Ignore storage restrictions
  }
}

function playTone(
  frequency: number,
  durationMs: number,
  type: OscillatorType = 'sine',
  volume = 0.06,
  delayMs = 0
): void {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const startTime = ctx.currentTime + delayMs / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationMs / 1000);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + durationMs / 1000 + 0.02);
  } catch {
    // Ignore WebAudio restrictions in background tabs
  }
}

export const soundFx = {
  move: () => playTone(420, 75, 'triangle', 0.05),
  flip: () => playTone(520, 65, 'sine', 0.045),
  match: () => {
    playTone(587.33, 100, 'triangle', 0.06, 0);
    playTone(880, 140, 'triangle', 0.06, 70);
  },
  eat: () => {
    playTone(620, 70, 'sine', 0.055, 0);
    playTone(820, 90, 'sine', 0.055, 45);
  },
  bonus: () => {
    playTone(523.25, 90, 'triangle', 0.06, 0);
    playTone(659.25, 90, 'triangle', 0.06, 65);
    playTone(1046.5, 160, 'triangle', 0.06, 130);
  },
  error: () => playTone(210, 140, 'sawtooth', 0.035),
  win: () => {
    playTone(523.25, 120, 'triangle', 0.06, 0);
    playTone(659.25, 120, 'triangle', 0.06, 90);
    playTone(783.99, 140, 'triangle', 0.06, 180);
    playTone(1046.5, 260, 'triangle', 0.07, 270);
  },
};
