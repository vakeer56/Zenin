import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { settingsApi } from '../api';
import { Card } from '../components/ui/Card';
import type { Settings } from '../../../shared/types';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { Bell, BellOff, BellRing, Smartphone, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

const DurationControl: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  unit?: string;
}> = ({ label, value, min, max, onChange, unit = 'min' }) => (
  <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
    <span className="text-sm font-medium">{label}</span>
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 rounded-lg glass glass-hover text-white/60 hover:text-white flex items-center justify-center font-bold transition-all"
      >
        −
      </button>
      <span className="w-16 text-center font-mono font-bold text-primary-300">
        {value} {unit}
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-8 h-8 rounded-lg glass glass-hover text-white/60 hover:text-white flex items-center justify-center font-bold transition-all"
      >
        +
      </button>
    </div>
  </div>
);

const Toggle: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, description, checked, onChange }) => (
  <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
    <div>
      <p className="text-sm font-medium">{label}</p>
      {description && <p className="text-xs text-white/40 mt-0.5">{description}</p>}
    </div>
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-12 h-6 rounded-full relative transition-all duration-200 ${
        checked ? 'bg-primary-500' : 'bg-white/15'
      }`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
          checked ? 'left-7' : 'left-1'
        }`}
      />
    </button>
  </div>
);

export const SettingsPage: React.FC = () => {
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get().then((r) => r.data.data),
  });

  const mutation = useMutation({
    mutationFn: (data: Partial<Settings>) => settingsApi.update(data),
    onSuccess: (res) => {
      qc.setQueryData(['settings'], res.data.data);
      toast.success('Settings saved');
    },
    onError: () => toast.error('Failed to save'),
  });

  const update = (key: keyof Settings, value: unknown) => {
    if (!settings) return;
    mutation.mutate({ [key]: value });
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-6 animate-fade-in">
        <div className="h-8 w-32 glass rounded-xl animate-pulse-slow mb-8" />
        {[1, 2].map((i) => (
          <div key={i} className="glass rounded-2xl h-48 animate-pulse-slow mb-4" />
        ))}
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="max-w-2xl mx-auto p-6 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-white/40 text-sm mt-1">Customize your focus sessions</p>
      </div>

      {/* Timer Durations */}
      <Card className="mb-4">
        <h2 className="font-semibold mb-2 text-white/80 text-sm uppercase tracking-wider">
          Timer Durations
        </h2>
        <DurationControl
          label="Focus Session"
          value={settings.workDuration}
          min={1}
          max={90}
          onChange={(v) => update('workDuration', v)}
        />
        <DurationControl
          label="Short Break"
          value={settings.shortBreak}
          min={1}
          max={30}
          onChange={(v) => update('shortBreak', v)}
        />
        <DurationControl
          label="Long Break"
          value={settings.longBreak}
          min={5}
          max={60}
          onChange={(v) => update('longBreak', v)}
        />
        <DurationControl
          label="Sessions Before Long Break"
          value={settings.sessionsBeforeLong}
          min={2}
          max={8}
          onChange={(v) => update('sessionsBeforeLong', v)}
          unit=""
        />
      </Card>

      {/* Automation */}
      <Card className="mb-4">
        <h2 className="font-semibold mb-2 text-white/80 text-sm uppercase tracking-wider">
          Automation
        </h2>
        <Toggle
          label="Auto-start Breaks"
          description="Automatically start break timer when focus ends"
          checked={settings.autoStartBreaks}
          onChange={(v) => update('autoStartBreaks', v)}
        />
        <Toggle
          label="Auto-start Sessions"
          description="Automatically start focus timer when break ends"
          checked={settings.autoStartPomodoros}
          onChange={(v) => update('autoStartPomodoros', v)}
        />
      </Card>

      {/* Sound */}
      <Card className="mb-4">
        <h2 className="font-semibold mb-2 text-white/80 text-sm uppercase tracking-wider">
          Notifications
        </h2>
        <Toggle
          label="Sound Notifications"
          description="Play sound when timer completes"
          checked={settings.soundEnabled}
          onChange={(v) => update('soundEnabled', v)}
        />
      </Card>

      {/* Push Notifications */}
      <PushNotificationsCard />
    </div>
  );
};

// ─── Push Notifications Card ──────────────────────────────────────────────────

const PushNotificationsCard: React.FC = () => {
  const {
    isSupported,
    isIOS,
    isStandalone,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    error,
  } = usePushNotifications();

  // iOS, not yet installed on Home Screen
  if (isIOS && !isStandalone) {
    return (
      <Card>
        <h2 className="font-semibold mb-3 text-white/80 text-sm uppercase tracking-wider">
          Push Notifications
        </h2>
        <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <Smartphone size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-300">Install to Home Screen first</p>
            <p className="text-xs text-white/50 mt-1 leading-relaxed">
              iOS only allows push notifications for installed PWAs. Tap{' '}
              <span className="font-semibold text-white/70">Share</span> →{' '}
              <span className="font-semibold text-white/70">Add to Home Screen</span> in
              Safari, then open the app from there to enable notifications.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // Browser doesn't support push at all
  if (!isSupported) {
    return (
      <Card>
        <h2 className="font-semibold mb-3 text-white/80 text-sm uppercase tracking-wider">
          Push Notifications
        </h2>
        <div className="flex items-center gap-3 py-2 text-white/40">
          <BellOff size={16} />
          <p className="text-sm">Push notifications are not supported on this browser.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="font-semibold mb-3 text-white/80 text-sm uppercase tracking-wider">
        Push Notifications
      </h2>

      {/* Status row */}
      <div className="flex items-center justify-between py-3 border-b border-white/5">
        <div className="flex items-start gap-3">
          {isSubscribed ? (
            <BellRing size={16} className="text-primary-400 mt-0.5 shrink-0" />
          ) : (
            <Bell size={16} className="text-white/40 mt-0.5 shrink-0" />
          )}
          <div>
            <p className="text-sm font-medium">
              {isSubscribed ? 'Notifications enabled' : 'Notifications disabled'}
            </p>
            <p className="text-xs text-white/40 mt-0.5">
              {isSubscribed
                ? 'You will receive timer alerts even when the app is closed.'
                : 'Get notified when your focus session or break ends.'}
            </p>
          </div>
        </div>

        {/* Toggle button */}
        {permission !== 'denied' && (
          <button
            id="push-toggle-btn"
            onClick={isSubscribed ? unsubscribe : subscribe}
            disabled={isLoading}
            className={`w-12 h-6 rounded-full relative transition-all duration-200 shrink-0 ${
              isSubscribed ? 'bg-primary-500' : 'bg-white/15'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading ? (
              <Loader2
                size={12}
                className="absolute inset-0 m-auto animate-spin text-white"
              />
            ) : (
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
                  isSubscribed ? 'left-7' : 'left-1'
                }`}
              />
            )}
          </button>
        )}
      </div>

      {/* Permission denied message */}
      {permission === 'denied' && (
        <div className="flex items-start gap-3 mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-white/60 leading-relaxed">
            Notifications are blocked. To enable them, go to your device{' '}
            <span className="font-semibold text-white/80">Settings → Zenin → Notifications</span>{' '}
            and allow notifications.
          </p>
        </div>
      )}

      {/* Subscribed confirmation */}
      {isSubscribed && permission === 'granted' && (
        <div className="flex items-center gap-2 mt-3 text-xs text-emerald-400/70">
          <CheckCircle2 size={13} />
          <span>Push notifications active</span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-3 text-xs text-red-400/80">{error}</p>
      )}
    </Card>
  );
};
