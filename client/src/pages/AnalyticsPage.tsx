import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Flame, Clock, Target, TrendingUp } from 'lucide-react';
import { analyticsApi } from '../api';
import { Card } from '../components/ui/Card';
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
  const [days, setDays] = useState<7 | 30>(7);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: () => analyticsApi.summary().then((r) => r.data.data),
  });

  const { data: daily, isLoading: dailyLoading } = useQuery({
    queryKey: ['analytics', 'daily', days],
    queryFn: () => analyticsApi.daily(days).then((r) => r.data.data),
  });

  const chartData = (daily ?? []).map((d) => ({
    date: format(new Date(d.date), days === 7 ? 'EEE' : 'MMM d'),
    pomodoros: d.pomodoros,
    minutes: d.focusMinutes,
  }));

  const maxPomodoros = Math.max(...(chartData.map((d) => d.pomodoros) || [0]), 1);

  return (
    <div className="max-w-4xl mx-auto p-6 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-white/40 text-sm mt-1">Track your focus journey</p>
      </div>

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
    </div>
  );
};
