import { useCallback } from 'react';

type SoundType = 'work_complete' | 'break_complete' | 'tick';

const ctx = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

const resumeCtx = async () => {
  if (ctx && ctx.state === 'suspended') {
    await ctx.resume();
  }
};

const playTone = (
  frequency: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine',
  delay = 0,
) => {
  if (!ctx) return;
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + delay);

  gainNode.gain.setValueAtTime(0, ctx.currentTime + delay);
  gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + delay + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

  oscillator.start(ctx.currentTime + delay);
  oscillator.stop(ctx.currentTime + delay + duration + 0.05);
};

const sounds: Record<SoundType, () => void> = {
  /**
   * Work complete — rising three-note arpeggio (triumphant)
   */
  work_complete: () => {
    playTone(523.25, 0.15, 0.4, 'sine', 0);      // C5
    playTone(659.25, 0.15, 0.4, 'sine', 0.18);   // E5
    playTone(783.99, 0.3, 0.4, 'sine', 0.36);    // G5
  },

  /**
   * Break complete — descending two-note notification
   */
  break_complete: () => {
    playTone(880, 0.15, 0.35, 'sine', 0);        // A5
    playTone(659.25, 0.3, 0.35, 'sine', 0.2);   // E5
  },

  /**
   * Tick — very subtle click for final countdown
   */
  tick: () => {
    playTone(1200, 0.04, 0.08, 'square', 0);
  },
};

export const useSound = (enabled: boolean) => {
  const play = useCallback(
    async (type: SoundType) => {
      if (!enabled || !ctx) return;
      await resumeCtx();
      sounds[type]?.();
    },
    [enabled]
  );

  return { play };
};
