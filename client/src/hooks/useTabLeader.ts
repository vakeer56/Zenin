/**
 * useTabLeader — BroadcastChannel-based leader election.
 *
 * Only the "leader" tab may run the timer.  Other tabs show a passive view.
 * Leadership is claimed immediately; if the leader tab closes, the next tab
 * to receive the `leader-gone` message claims leadership.
 *
 * Messages:
 *   { type: 'claim' }         — broadcast when a tab wants to be leader
 *   { type: 'leader-gone' }  — broadcast by leader on `beforeunload`
 *   { type: 'state-sync', state: TimerSnapshot } — leader broadcasts state
 *   { type: 'ping' }         — followers ping to confirm leader still alive
 *   { type: 'pong' }         — leader responds to ping
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useTimerStore } from '../store/timerStore';

export interface TimerSnapshot {
  phase: string;
  secondsLeft: number;
  totalSeconds: number;
  isRunning: boolean;
  sessionCount: number;
}

const CHANNEL = 'pomodoro-timer';
const HEARTBEAT_MS = 2000;
const LEADER_TIMEOUT_MS = 5000;

export const useTabLeader = () => {
  const [isLeader, setIsLeader] = useState(false);
  const [followerState, setFollowerState] = useState<TimerSnapshot | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const pingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const broadcast = useCallback((msg: Record<string, unknown>) => {
    channelRef.current?.postMessage(msg);
  }, []);

  // ── Claim leadership ───────────────────────────────────────────────────────
  const claimLeadership = useCallback(() => {
    setIsLeader(true);
    broadcast({ type: 'claim' });
  }, [broadcast]);

  // ── Heartbeat (leader → follower) ──────────────────────────────────────────
  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(() => {
      const s = useTimerStore.getState();
      broadcast({
        type: 'state-sync',
        state: {
          phase: s.phase,
          secondsLeft: s.secondsLeft,
          totalSeconds: s.totalSeconds,
          isRunning: s.isRunning,
          sessionCount: s.sessionCount,
        } satisfies TimerSnapshot,
      });
    }, HEARTBEAT_MS);
  }, [broadcast]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
  }, []);

  // ── Follower: watch for leader timeout ────────────────────────────────────
  const resetPingTimeout = useCallback(() => {
    if (pingTimeoutRef.current) clearTimeout(pingTimeoutRef.current);
    pingTimeoutRef.current = setTimeout(() => {
      // Leader gone — claim leadership
      claimLeadership();
    }, LEADER_TIMEOUT_MS);
  }, [claimLeadership]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') {
      // Unsupported (e.g. older Safari) — always be leader
      setIsLeader(true);
      return;
    }

    const bc = new BroadcastChannel(CHANNEL);
    channelRef.current = bc;

    bc.onmessage = (event) => {
      const msg = event.data as { type: string; state?: TimerSnapshot };

      switch (msg.type) {
        case 'claim':
          // Another tab became leader — we become follower
          if (isLeader) {
            setIsLeader(false);
            stopHeartbeat();
          }
          resetPingTimeout();
          break;

        case 'state-sync':
          if (!isLeader && msg.state) {
            setFollowerState(msg.state);
            resetPingTimeout();
          }
          break;

        case 'leader-gone':
          // Existing leader left — claim leadership
          claimLeadership();
          break;

        case 'ping':
          if (isLeader) broadcast({ type: 'pong' });
          break;

        case 'pong':
          resetPingTimeout();
          break;
      }
    };

    // Try to claim leadership immediately
    // Small random delay avoids thundering-herd when multiple tabs load at once
    const claimDelay = Math.random() * 200;
    const timer = setTimeout(() => {
      claimLeadership();
    }, claimDelay);

    return () => {
      clearTimeout(timer);
      stopHeartbeat();
      if (pingTimeoutRef.current) clearTimeout(pingTimeoutRef.current);
      bc.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Start/stop heartbeat based on leadership
  useEffect(() => {
    if (isLeader) {
      startHeartbeat();
    } else {
      stopHeartbeat();
      resetPingTimeout();
    }
    return stopHeartbeat;
  }, [isLeader]);

  // Announce leadership loss before tab closes
  useEffect(() => {
    if (!isLeader) return;
    const handler = () => broadcast({ type: 'leader-gone' });
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isLeader, broadcast]);

  return { isLeader, followerState };
};
