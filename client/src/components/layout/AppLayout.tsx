import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';

export const AppLayout: React.FC = () => (
  <div className="min-h-screen bg-surface-900">
    <Navbar />
    <main className="md:ml-64 min-h-screen pb-20 md:pb-0">
      <Outlet />
    </main>
  </div>
);
