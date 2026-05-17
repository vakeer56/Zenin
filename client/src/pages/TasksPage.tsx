import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Check, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { tasksApi } from '../api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { cn } from '../utils/cn';
import type { Task } from '../../../shared/types';

const taskSchema = z.object({
  title: z.string().min(1, 'Title required').max(500),
  estimatedPomodoros: z.number().int().min(1).max(50).default(1),
});
type TaskForm = z.infer<typeof taskSchema>;

const TaskItem: React.FC<{ task: Task }> = ({ task }) => {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.delete(task.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
    onError: () => toast.error('Failed to delete task'),
  });

  const completeMutation = useMutation({
    mutationFn: () => tasksApi.complete(task.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task completed! 🎉');
    },
  });

  const pomodoroProgress = Math.min(task.completedPomodoros / task.estimatedPomodoros, 1);

  return (
    <div
      id={`task-item-${task.id}`}
      className={cn(
        'glass rounded-xl p-4 transition-all duration-200',
        task.isCompleted && 'opacity-50'
      )}
    >
      <div className="flex items-center gap-3">
        <button
          id={`complete-task-${task.id}`}
          onClick={() => !task.isCompleted && completeMutation.mutate()}
          disabled={task.isCompleted || completeMutation.isPending}
          className={cn(
            'w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all',
            task.isCompleted
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-white/20 hover:border-primary-400 hover:bg-primary-500/10'
          )}
        >
          {task.isCompleted && <Check size={12} />}
        </button>

        <div className="flex-1 min-w-0">
          <p className={cn('font-medium text-sm truncate', task.isCompleted && 'line-through text-white/40')}>
            {task.title}
          </p>
          {/* Pomodoro bar */}
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-500 to-orange-400 rounded-full transition-all duration-500"
                style={{ width: `${pomodoroProgress * 100}%` }}
              />
            </div>
            <span className="text-xs text-white/40 flex-shrink-0">
              {task.completedPomodoros}/{task.estimatedPomodoros} sessions
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            id={`delete-task-${task.id}`}
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export const TasksPage: React.FC = () => {
  const qc = useQueryClient();
  const [showCompleted, setShowCompleted] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<TaskForm>({
    resolver: zodResolver(taskSchema) as any,
    defaultValues: { estimatedPomodoros: 1 },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.list().then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: TaskForm) => tasksApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      reset();
      toast.success('Task added!');
    },
    onError: () => toast.error('Failed to add task'),
  });

  const tasks = data ?? [];
  const active = tasks.filter((t) => !t.isCompleted);
  const completed = tasks.filter((t) => t.isCompleted);
  const totalPomodoros = active.reduce((s, t) => s + t.estimatedPomodoros, 0);
  const donePomodoros = active.reduce((s, t) => s + t.completedPomodoros, 0);

  return (
    <div className="max-w-2xl mx-auto p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-white/40 text-sm mt-1">
            {active.length} active · {donePomodoros}/{totalPomodoros} sessions done
          </p>
        </div>
      </div>

      {/* Add task form */}
      <Card className="mb-6">
        <form
          id="add-task-form"
          onSubmit={handleSubmit((data) => createMutation.mutate(data))}
          className="flex gap-3 flex-col sm:flex-row"
        >
          <div className="flex-1">
            <Input
              id="task-title-input"
              placeholder="What are you working on?"
              {...register('title')}
              error={errors.title?.message}
            />
          </div>
          <div className="flex gap-3 sm:items-start">
            <div className="w-24">
              <Input
                id="task-pomodoros-input"
                type="number"
                min={1}
                max={50}
                placeholder="Sessions"
                {...register('estimatedPomodoros')}
              />
            </div>
            <Button
              type="submit"
              id="add-task-submit"
              loading={isSubmitting || createMutation.isPending}
              className="flex-shrink-0 sm:mt-0 mt-0"
            >
              <Plus size={18} />
              Add
            </Button>
          </div>
        </form>
      </Card>

      {/* Active tasks */}
      <div className="flex flex-col gap-2 mb-6">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass rounded-xl p-4 h-16 animate-pulse-slow" />
          ))
        ) : active.length === 0 ? (
          <div className="text-center py-12 text-white/30">
            <p className="text-4xl mb-3">📋</p>
            <p>No active tasks. Add one above!</p>
          </div>
        ) : (
          active.map((task) => <TaskItem key={task.id} task={task} />)
        )}
      </div>

      {/* Completed tasks */}
      {completed.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 mb-3 transition-colors"
          >
            {showCompleted ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Completed ({completed.length})
          </button>
          {showCompleted && (
            <div className="flex flex-col gap-2">
              {completed.map((task) => <TaskItem key={task.id} task={task} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
