import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { DashboardProvider } from './context/DashboardContext';

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <DashboardProvider>
      <App />
    </DashboardProvider>
  );
}
