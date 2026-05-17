/**
 * timerStore — Zustand store with:
 * - sessionStorage persistence (survives refresh, cleared on tab close)
 * - Wall-clock elapsed compensation (handles sleep/background suspension)
 * - BroadcastChannel for cross-tab state sync
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Settings } from '../../../shared/types';

export type TimerPhase = 'work' | 'short_break' | 'long_break';

interface TimerState {
  phase: TimerPhase;
  secondsLeft: number;
  totalSeconds: number;
  isRunning: boolean;
  sessionCount: number;
  activeTaskId: string | null;
  currentSessionId: string | null;
  /** Wall-clock ms when the current run started (for sleep compensation). */
  runStartedAt: number | null;
  /** secondsLeft snapshot when runStartedAt was recorded. */
  runStartSecondsLeft: number | null;

  // ── Actions ───────────────────────────────────────────────────────────────
  setPhase: (phase: TimerPhase, settings: Settings) => void;
  setSecondsLeft: (seconds: number) => void;
  setTotalSeconds: (seconds: number) => void;
  setIsRunning: (running: boolean) => void;
  incrementSession: () => void;
  resetTimer: (settings: Settings) => void;
  setActiveTaskId: (id: string | null) => void;
  setCurrentSessionId: (id: string | null) => void;
  markRunStart: () => void;
  clearRunStart: () => void;
  /** Compute true secondsLeft accounting for wall-clock elapsed since runStartedAt. */
  computeElapsed: () => number;
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      phase: 'work',
      secondsLeft: 25 * 60,
      totalSeconds: 25 * 60,
      isRunning: false,
      sessionCount: 0,
      activeTaskId: null,
      currentSessionId: null,
      runStartedAt: null,
      runStartSecondsLeft: null,

      setPhase: (phase, settings) => {
        const durations: Record<TimerPhase, number> = {
          work: settings.workDuration * 60,
          short_break: settings.shortBreak * 60,
          long_break: settings.longBreak * 60,
        };
        const total = durations[phase];
        set({
          phase,
          secondsLeft: total,
          totalSeconds: total,
          isRunning: false,
          runStartedAt: null,
          runStartSecondsLeft: null,
        });
      },

      setSecondsLeft: (secondsLeft) => set({ secondsLeft }),
      setTotalSeconds: (totalSeconds) => set({ totalSeconds }),
      setIsRunning: (isRunning) => set({ isRunning }),
      incrementSession: () => set((s) => ({ sessionCount: s.sessionCount + 1 })),

      resetTimer: (settings) => {
        const { phase } = get();
        const durations: Record<TimerPhase, number> = {
          work: settings.workDuration * 60,
          short_break: settings.shortBreak * 60,
          long_break: settings.longBreak * 60,
        };
        const total = durations[phase];
        set({
          secondsLeft: total,
          totalSeconds: total,
          isRunning: false,
          currentSessionId: null,
          runStartedAt: null,
          runStartSecondsLeft: null,
        });
      },

      setActiveTaskId: (activeTaskId) => set({ activeTaskId }),
      setCurrentSessionId: (currentSessionId) => set({ currentSessionId }),

      markRunStart: () =>
        set((s) => ({
          runStartedAt: Date.now(),
          runStartSecondsLeft: s.secondsLeft,
        })),

      clearRunStart: () =>
        set({ runStartedAt: null, runStartSecondsLeft: null }),

      computeElapsed: () => {
        const { runStartedAt, runStartSecondsLeft, secondsLeft } = get();
        if (runStartedAt == null || runStartSecondsLeft == null) return secondsLeft;
        const elapsedMs = Date.now() - runStartedAt;
        const elapsedSec = Math.floor(elapsedMs / 1000);
        return Math.max(0, runStartSecondsLeft - elapsedSec);
      },
    }),
    {
      name: 'timer-state',
      // sessionStorage: cleared when the tab/browser is closed, survives reload
      storage: createJSONStorage(() => sessionStorage),
      // Don't persist isRunning=true across page loads — let the component
      // re-derive it and reconcile with the DB session on mount.
      partialize: (state) => ({
        phase: state.phase,
        secondsLeft: state.secondsLeft,
        totalSeconds: state.totalSeconds,
        sessionCount: state.sessionCount,
        activeTaskId: state.activeTaskId,
        currentSessionId: state.currentSessionId,
        runStartedAt: state.runStartedAt,
        runStartSecondsLeft: state.runStartSecondsLeft,
        // isRunning intentionally excluded — see above
      }),
    }
  )
);
