import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import './index.css';

import { AuthPage } from './pages/AuthPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { TimerPage } from './pages/TimerPage';
import { TasksPage } from './pages/TasksPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,   // 1 minute
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* Protected */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/timer" element={<TimerPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          {/* Default */}
          <Route path="/" element={<Navigate to="/timer" replace />} />
          <Route path="*" element={<Navigate to="/timer" replace />} />
        </Routes>
      </BrowserRouter>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(26, 26, 46, 0.95)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            backdropFilter: 'blur(12px)',
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
);
