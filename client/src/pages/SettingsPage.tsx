import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { settingsApi } from '../api';
import { Card } from '../components/ui/Card';
import type { Settings } from '../../../shared/types';

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
      <Card>
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
    </div>
  );
};
