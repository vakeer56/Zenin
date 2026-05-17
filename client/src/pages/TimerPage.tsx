import React, { useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, SkipForward, WifiOff, MonitorSmartphone } from 'lucide-react';
import { useTimerStore } from '../store/timerStore';
import type { TimerPhase } from '../store/timerStore';
import { settingsApi, sessionsApi, tasksApi } from '../api';
import { TimerRing } from '../components/timer/TimerRing';
import { cn } from '../utils/cn';
import { useSound } from '../hooks/useSound';
import { useTabLeader } from '../hooks/useTabLeader';
import { offlineQueue, replayOfflineQueue } from '../utils/offlineQueue';
import { useAuthStore } from '../store/authStore';
import type { Settings } from '../../../shared/types';

const phaseLabels: Record<TimerPhase, string> = {
  work: 'Focus',
  short_break: 'Break',
  long_break: 'Long Break',
};

const formatTime = (s: number) => {
  const m = Math.floor(Math.max(0, s) / 60).toString().padStart(2, '0');
  const sec = (Math.max(0, s) % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
};

const getDuration = (settings: Settings, phase: TimerPhase) =>
  ({ work: settings.workDuration * 60, short_break: settings.shortBreak * 60, long_break: settings.longBreak * 60 }[phase]);

// ─────────────────────────────────────────────────────────────────────────────

export const TimerPage: React.FC = () => {
  const qc = useQueryClient();
  const { accessToken } = useAuthStore();

  const { isLeader, followerState } = useTabLeader();

  const {
    phase, secondsLeft, totalSeconds, isRunning,
    activeTaskId, currentSessionId,
    setPhase, setSecondsLeft, setTotalSeconds, setIsRunning, incrementSession,
    resetTimer, setActiveTaskId, setCurrentSessionId,
    markRunStart, clearRunStart, computeElapsed,
  } = useTimerStore();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get().then((r) => r.data.data),
  });

  const { data: tasksData } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.list().then((r) => r.data.data),
  });

  const { play: playSound } = useSound(settings?.soundEnabled ?? true);
  const isOnline = useRef(navigator.onLine);

  useEffect(() => {
    const onOnline = () => {
      isOnline.current = true;
      replayOfflineQueue('/api', () => accessToken);
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    };
    const onOffline = () => { isOnline.current = false; };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, [accessToken]);

  const startSessionMutation = useMutation({
    mutationFn: (data: Parameters<typeof sessionsApi.start>[0]) => sessionsApi.start(data),
  });

  const endSessionMutation = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) => sessionsApi.end(id, completed),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); qc.invalidateQueries({ queryKey: ['analytics'] }); },
    onError: (_err, variables) => {
      offlineQueue.enqueue({ url: `/sessions/${variables.id}/end`, method: 'PATCH', body: { completed: variables.completed } });
    },
  });

  const tasks = tasksData ?? [];
  const activeTasks = tasks.filter((t) => !t.isCompleted);
  
  const displaySeconds = isLeader ? secondsLeft : (followerState?.secondsLeft ?? secondsLeft);
  const displayTotal   = isLeader ? totalSeconds : (followerState?.totalSeconds ?? totalSeconds);
  const displayRunning = isLeader ? isRunning   : (followerState?.isRunning ?? false);
  const displayPhase   = isLeader ? phase       : ((followerState?.phase as TimerPhase) ?? phase);
  const progress = displayTotal > 0 ? displaySeconds / displayTotal : 0;

  useEffect(() => {
    if (settings && !isRunning && isLeader) {
      const duration = getDuration(settings, phase);
      if (totalSeconds !== duration) {
        setTotalSeconds(duration);
        setSecondsLeft(duration);
      }
    }
  }, [settings]);

  useEffect(() => {
    if (!isLeader) return;
    const storedSessionId = useTimerStore.getState().currentSessionId;
    const wasRunning = useTimerStore.getState().runStartedAt !== null;

    if (storedSessionId) {
      if (wasRunning) {
        const trueSecs = computeElapsed();
        if (trueSecs <= 0) {
          endSessionMutation.mutate({ id: storedSessionId, completed: true });
          setCurrentSessionId(null);
          clearRunStart();
          setIsRunning(false);
          incrementSession();
        } else {
          setSecondsLeft(trueSecs);
          clearRunStart();
        }
      } else {
        endSessionMutation.mutate({ id: storedSessionId, completed: false });
        setCurrentSessionId(null);
      }
    }
  }, [isLeader]);

  const settingsRef  = useRef(settings);
  const phaseRef     = useRef(phase);
  const sessionIdRef = useRef(currentSessionId);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { sessionIdRef.current = currentSessionId; }, [currentSessionId]);

  const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const handleCompleteRef = useRef<(() => Promise<void>) | undefined>(undefined);

  useEffect(() => {
    if (!isLeader) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && isRunning) {
        const trueSecs = computeElapsed();
        if (trueSecs <= 0) {
          clearInterval(intervalRef.current!);
          handleCompleteRef.current?.();
        } else {
          setSecondsLeft(trueSecs);
          markRunStart(); 
        }
      }
      void (window as any).__audioCtx?.resume?.();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isLeader, isRunning]);

  handleCompleteRef.current = async () => {
    const currentSettings = settingsRef.current;
    const currentPhase    = phaseRef.current;
    const sessionId       = sessionIdRef.current;

    setIsRunning(false);
    clearRunStart();
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (sessionId) {
      try { await endSessionMutation.mutateAsync({ id: sessionId, completed: true }); } catch {}
      setCurrentSessionId(null);
    }

    if (currentPhase === 'work') {
      incrementSession();
      await playSound('work_complete');
      if (currentSettings) {
        const newCount = useTimerStore.getState().sessionCount;
        const nextPhase: TimerPhase = newCount % currentSettings.sessionsBeforeLong === 0 ? 'long_break' : 'short_break';
        setPhase(nextPhase, currentSettings);
        if (currentSettings.autoStartBreaks) setTimeout(() => startPhase(nextPhase), 300);
      }
    } else {
      await playSound('break_complete');
      if (currentSettings) {
        setPhase('work', currentSettings);
        if (currentSettings.autoStartPomodoros) setTimeout(() => startPhase('work'), 300);
      }
    }
  };

  useEffect(() => {
    if (!isLeader) return;
    if (isRunning) {
      intervalRef.current = setInterval(async () => {
        const current = useTimerStore.getState().secondsLeft;
        if (current <= 5 && current > 1) { settingsRef.current?.soundEnabled && playSound('tick'); }
        if (current <= 1) {
          clearInterval(intervalRef.current!);
          await handleCompleteRef.current?.();
        } else {
          setSecondsLeft(current - 1);
        }
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, isLeader]);

  useEffect(() => {
    document.title = displayRunning
      ? `${formatTime(displaySeconds)} — ${phaseLabels[displayPhase]}`
      : 'Focus Timer';
  }, [displaySeconds, displayRunning, displayPhase]);

  const startPhase = useCallback(async (targetPhase?: TimerPhase) => {
    if (!isLeader) return;
    const activePhase    = targetPhase ?? phaseRef.current;
    const activeSettings = settingsRef.current;
    const sessionId      = sessionIdRef.current;

    setIsRunning(true);
    markRunStart();

    if (!sessionId) {
      const durationSeconds = activeSettings ? getDuration(activeSettings, activePhase) : useTimerStore.getState().secondsLeft;
      try {
        const res = await startSessionMutation.mutateAsync({
          type: activePhase,
          durationSeconds,
          taskId: useTimerStore.getState().activeTaskId ?? undefined,
        });
        setCurrentSessionId(res.data.data.id);
      } catch {
        offlineQueue.enqueue({ url: '/sessions', method: 'POST', body: { type: activePhase, durationSeconds, taskId: useTimerStore.getState().activeTaskId ?? undefined } });
      }
    }
  }, [isLeader]);

  const handlePause = useCallback(async () => {
    if (!isLeader) return;
    setIsRunning(false);
    clearRunStart();
    const sessionId = sessionIdRef.current;
    if (sessionId) {
      try { await endSessionMutation.mutateAsync({ id: sessionId, completed: false }); } catch {}
      setCurrentSessionId(null);
    }
  }, [isLeader]);

  const handleReset = useCallback(() => {
    if (!isLeader) return;
    setIsRunning(false);
    clearRunStart();
    const sessionId = sessionIdRef.current;
    if (sessionId) {
      endSessionMutation.mutate({ id: sessionId, completed: false });
      setCurrentSessionId(null);
    }
    if (settings) resetTimer(settings);
  }, [isLeader, settings]);

  const handleSkip = useCallback(async () => {
    if (!isLeader) return;
    setIsRunning(false);
    clearRunStart();
    const sessionId = sessionIdRef.current;
    if (sessionId) {
      try { await endSessionMutation.mutateAsync({ id: sessionId, completed: false }); } catch {}
      setCurrentSessionId(null);
    }
    if (settings) {
      const nextPhase: TimerPhase = phase === 'work' ? 'short_break' : 'work';
      setPhase(nextPhase, settings);
    }
  }, [isLeader, settings, phase]);

  const switchPhase = (newPhase: TimerPhase) => {
    if (!isLeader || isRunning) return;
    if (settings) setPhase(newPhase, settings);
  };

  const phaseColor: Record<TimerPhase, string> = {
    work: 'text-white', short_break: 'text-[#a3e635]', long_break: 'text-[#60a5fa]',
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 animate-fade-in bg-black">

      {/* Top Banners */}
      <div className="absolute top-6 flex flex-col gap-2 items-center text-xs opacity-50">
        {!isLeader && <span className="flex items-center gap-1"><MonitorSmartphone size={12}/> Syncing live</span>}
        {!navigator.onLine && <span className="flex items-center gap-1"><WifiOff size={12}/> Offline</span>}
      </div>

      {/* Phase selection */}
      <div className="flex gap-10 mb-16 text-xl tracking-wider font-light">
        {(Object.keys(phaseLabels) as TimerPhase[]).map((p) => (
          <button
            key={p}
            onClick={() => switchPhase(p)}
            disabled={displayRunning || !isLeader}
            className={cn(
              'transition-all duration-300 disabled:cursor-not-allowed uppercase',
              displayPhase === p ? 'opacity-100 font-medium scale-105' : 'opacity-30 hover:opacity-70'
            )}
          >
            {phaseLabels[p]}
          </button>
        ))}
      </div>

      {/* Huge Timer */}
      <div className="relative flex justify-center items-center w-full max-w-lg mb-12">
        <TimerRing progress={progress} phase={displayPhase} size={360}>
          <span className={cn(
            'text-[6rem] sm:text-[8rem] font-extralight tracking-tighter tabular-nums leading-none select-none',
            phaseColor[displayPhase]
          )}>
            {formatTime(displaySeconds)}
          </span>
        </TimerRing>
      </div>

      {/* Play/Pause Minimal Text Button */}
      <button
        onClick={displayRunning ? handlePause : () => startPhase()}
        disabled={!isLeader}
        className={cn(
          "text-2xl font-light tracking-widest uppercase transition-opacity duration-300 hover:opacity-70 mb-10",
          phaseColor[displayPhase]
        )}
      >
        {displayRunning ? 'Pause' : 'Start'}
      </button>

      {/* Tiny subtle controls */}
      <div className="flex items-center gap-8 opacity-30 hover:opacity-100 transition-opacity duration-300">
        <button onClick={handleReset} disabled={!isLeader} className="p-2 disabled:cursor-not-allowed"><RotateCcw strokeWidth={1.5} size={20} /></button>
        <button onClick={handleSkip} disabled={!isLeader} className="p-2 disabled:cursor-not-allowed"><SkipForward strokeWidth={1.5} size={20} /></button>
      </div>

      {/* Task indicator (ultra minimal) */}
      {isLeader && activeTasks.length > 0 && (
        <div className="absolute bottom-10 flex flex-col items-center gap-3">
          <p className="text-[10px] tracking-widest uppercase opacity-30">Assign Task</p>
          <div className="flex flex-wrap justify-center gap-4 max-w-md">
            {activeTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => setActiveTaskId(activeTaskId === task.id ? null : task.id)}
                className={cn(
                  'text-xs font-light transition-all duration-300 border-b',
                  activeTaskId === task.id ? 'opacity-100 border-white pb-0.5' : 'opacity-30 border-transparent hover:opacity-60'
                )}
              >
                {task.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
