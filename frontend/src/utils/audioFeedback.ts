// Audio feedback utility using Web Audio API
// Provides synthesized tones for POS system feedback

const STORAGE_KEY = 'pos-audio-enabled';

let audioContext: AudioContext | null = null;
let isEnabled = true;

// Initialize audio context lazily (requires user interaction)
const getAudioContext = (): AudioContext | null => {
  if (!audioContext && typeof window !== 'undefined' && window.AudioContext) {
    try {
      audioContext = new AudioContext();
    } catch {
      console.warn('Web Audio API not supported');
      return null;
    }
  }
  return audioContext;
};

// Load enabled state from localStorage
const loadEnabledState = (): boolean => {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === 'true';
};

// Initialize enabled state
isEnabled = loadEnabledState();

// Play a tone with specified frequency and duration
const playTone = (
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  gain: number = 0.3
): void => {
  if (!isEnabled) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  // Resume context if suspended (required after user interaction)
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

  // Envelope: quick attack, sustain, quick release
  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.01);
  gainNode.gain.linearRampToValueAtTime(gain * 0.7, ctx.currentTime + duration * 0.8);
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration);
};

// Play a chord (multiple frequencies simultaneously)
const playChord = (
  frequencies: number[],
  duration: number,
  type: OscillatorType = 'sine',
  gain: number = 0.2
): void => {
  frequencies.forEach((freq) => {
    playTone(freq, duration, type, gain / frequencies.length);
  });
};

export const audioFeedback = {
  /**
   * Play success sound - pleasant two-tone ascending chord
   * Used for successful transactions
   */
  playSuccess: (): void => {
    // C5 (523Hz) + E5 (659Hz) + G5 (784Hz) - Major chord
    playChord([523, 659, 784], 0.2, 'sine', 0.4);
  },

  /**
   * Play error sound - lower buzz tone
   * Used for failed operations or errors
   */
  playError: (): void => {
    // Low tone with slight dissonance
    playTone(200, 0.25, 'sawtooth', 0.2);
    setTimeout(() => playTone(180, 0.25, 'sawtooth', 0.15), 150);
  },

  /**
   * Play tap sound - subtle click feedback
   * Used for button presses (optional)
   */
  playTap: (): void => {
    playTone(800, 0.05, 'sine', 0.15);
  },

  /**
   * Play selection sound - soft confirmation
   * Used when selecting items
   */
  playSelect: (): void => {
    playTone(600, 0.08, 'sine', 0.2);
  },

  /**
   * Enable or disable audio feedback
   */
  setEnabled: (enabled: boolean): void => {
    isEnabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    }
  },

  /**
   * Check if audio feedback is enabled
   */
  isEnabled: (): boolean => {
    return isEnabled;
  },

  /**
   * Toggle audio feedback on/off
   */
  toggle: (): boolean => {
    isEnabled = !isEnabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(isEnabled));
    }
    return isEnabled;
  },

  /**
   * Initialize audio context (call after user interaction)
   * Required for browsers that require user gesture to play audio
   */
  init: (): void => {
    getAudioContext();
  },
};

export default audioFeedback;
