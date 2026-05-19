import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Flame, Clock, Target, TrendingUp, Plus, Trash2 } from 'lucide-react';
import { analyticsApi, sessionsApi, tasksApi } from '../api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}> = ({ icon, label, value, sub, color }) => (
  <Card className="flex items-center gap-4">
    <div className={`p-3 rounded-xl ${color} bg-opacity-15`}>
      {icon}
    </div>
    <div>
      <p className="text-white/50 text-xs font-medium">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-white/30">{sub}</p>}
    </div>
  </Card>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="glass rounded-xl p-3 text-sm">
        <p className="text-white/60 mb-1">{label}</p>
        <p className="font-bold text-red-400">{payload[0]?.value} 🍅</p>
        <p className="text-white/40">{payload[1]?.value} min</p>
      </div>
    );
  }
  return null;
};

export const AnalyticsPage: React.FC = () => {
  const qc = useQueryClient();
  const [days, setDays] = useState<7 | 30>(7);
  const [showLogTime, setShowLogTime] = useState(false);
  const [logMinutes, setLogMinutes] = useState('');
  const [logTaskId, setLogTaskId] = useState('');

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: () => analyticsApi.summary().then((r) => r.data.data),
  });

  const { data: daily, isLoading: dailyLoading } = useQuery({
    queryKey: ['analytics', 'daily', days],
    queryFn: () => analyticsApi.daily(days).then((r) => r.data.data),
  });

  const { data: tasksData } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.list().then((r) => r.data.data),
  });
  const activeTasks = (tasksData ?? []).filter((t) => !t.isCompleted);

  const logTimeMutation = useMutation({
    mutationFn: (data: { durationMinutes: number; taskId?: string }) => sessionsApi.manual(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Time logged successfully!');
      setShowLogTime(false);
      setLogMinutes('');
      setLogTaskId('');
    },
    onError: () => toast.error('Failed to log time'),
  });

  const handleLogTime = (e: React.FormEvent) => {
    e.preventDefault();
    const mins = parseInt(logMinutes);
    if (!mins || mins <= 0) return toast.error('Please enter a valid duration');
    logTimeMutation.mutate({ durationMinutes: mins, taskId: logTaskId || undefined });
  };

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions', 1],
    queryFn: () => sessionsApi.list(1).then((r) => r.data.data),
  });
  const recentSessions = (sessionsData ?? []).slice(0, 5);

  const deleteSessionMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session deleted');
    },
    onError: () => toast.error('Failed to delete session'),
  });

  const chartData = (daily ?? []).map((d) => ({
    date: format(new Date(d.date), days === 7 ? 'EEE' : 'MMM d'),
    pomodoros: d.pomodoros,
    minutes: d.focusMinutes,
  }));

  const maxPomodoros = Math.max(...(chartData.map((d) => d.pomodoros) || [0]), 1);

  return (
    <div className="max-w-4xl mx-auto p-6 animate-fade-in">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-white/40 text-sm mt-1">Track your focus journey</p>
        </div>
        <Button onClick={() => setShowLogTime(!showLogTime)} className="text-sm h-9 px-4">
          {showLogTime ? 'Cancel' : 'Log Time'}
        </Button>
      </div>

      {showLogTime && (
        <Card className="mb-8 p-5 bg-white/[0.02] border-white/10">
          <form onSubmit={handleLogTime} className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="text-xs text-white/50 mb-1.5 block uppercase tracking-wider">Duration (minutes)</label>
              <Input
                type="number"
                min={1}
                value={logMinutes}
                onChange={(e) => setLogMinutes(e.target.value)}
                placeholder="e.g. 25"
                required
              />
            </div>
            <div className="flex-1 w-full">
              <label className="text-xs text-white/50 mb-1.5 block uppercase tracking-wider">Task (optional)</label>
              <select
                value={logTaskId}
                onChange={(e) => setLogTaskId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary-500/50 transition-colors h-[42px]"
              >
                <option value="">No Task (General)</option>
                {activeTasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
            <Button type="submit" loading={logTimeMutation.isPending} className="w-full sm:w-auto h-[42px]">
              <Plus size={16} className="mr-1" /> Add Time
            </Button>
          </form>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Target size={20} className="text-red-400" />}
          label="Total Sessions"
          value={summaryLoading ? '—' : summary?.totalPomodoros ?? 0}
          color="bg-red-500/15"
        />
        <StatCard
          icon={<Clock size={20} className="text-blue-400" />}
          label="Total Focus"
          value={summaryLoading ? '—' : `${summary?.totalFocusMinutes ?? 0}m`}
          sub={`≈ ${Math.floor((summary?.totalFocusMinutes ?? 0) / 60)}h`}
          color="bg-blue-500/15"
        />
        <StatCard
          icon={<Flame size={20} className="text-orange-400" />}
          label="Current Streak"
          value={summaryLoading ? '—' : `${summary?.currentStreak ?? 0} days`}
          color="bg-orange-500/15"
        />
        <StatCard
          icon={<TrendingUp size={20} className="text-green-400" />}
          label="Best Streak"
          value={summaryLoading ? '—' : `${summary?.longestStreak ?? 0} days`}
          color="bg-green-500/15"
        />
      </div>

      {/* Today */}
      {summary && (
        <Card className="mb-8 flex flex-col sm:flex-row gap-6">
          <div className="flex-1">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Today's Focus</p>
            <p className="text-3xl font-bold text-red-400">{summary.todayPomodoros}</p>
            <p className="text-white/40 text-sm">sessions</p>
          </div>
          <div className="flex-1">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Today's Time</p>
            <p className="text-3xl font-bold text-blue-400">{summary.todayFocusMinutes}m</p>
            <p className="text-white/40 text-sm">focused</p>
          </div>
        </Card>
      )}

      {/* Chart */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold">Daily Sessions</h2>
          <div className="flex gap-1 p-1 glass rounded-lg">
            {([7, 30] as const).map((d) => (
              <button
                key={d}
                id={`analytics-days-${d}`}
                onClick={() => setDays(d)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  days === d ? 'bg-primary-500/30 text-primary-300' : 'text-white/40 hover:text-white'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {dailyLoading ? (
          <div className="h-48 flex items-center justify-center text-white/30">Loading…</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barSize={days === 7 ? 28 : 12}>
              <XAxis
                dataKey="date"
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="pomodoros" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={
                      entry.pomodoros === maxPomodoros && entry.pomodoros > 0
                        ? '#ef4444'
                        : 'rgba(239,68,68,0.35)'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Recent Sessions */}
      <Card className="mt-8">
        <h2 className="font-semibold mb-4">Recent Sessions</h2>
        {sessionsLoading ? (
          <div className="text-white/30 py-4 text-center text-sm">Loading…</div>
        ) : recentSessions.length === 0 ? (
          <div className="text-white/30 py-4 text-center text-sm">No recent sessions found.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {recentSessions.map(session => (
              <div key={session.id} className="flex items-center justify-between p-3 glass rounded-xl">
                <div>
                  <p className="text-sm font-medium">
                    {session.type === 'work' ? 'Focus Session' : 'Break'}
                  </p>
                  <p className="text-xs text-white/40">
                    {format(new Date(session.startedAt), 'MMM d, h:mm a')} • {Math.round(session.durationSeconds / 60)} min
                  </p>
                </div>
                <button
                  onClick={() => deleteSessionMutation.mutate(session.id)}
                  disabled={deleteSessionMutation.isPending}
                  className="p-2 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
