import React from 'react';
import ReactDOM from 'react-dom/client';
import { useDashboard, DashboardProvider } from './context/DashboardContext';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import FilterBar from './components/FilterBar';
import LoadingScreen from './components/LoadingScreen';
import OverviewPage from './pages/OverviewPage';
import MonthDayPage from './pages/MonthDayPage';
import DatabasePage from './pages/DatabasePage';
import ProductionPage from './pages/ProductionPage';
import WIPPage from './pages/WIPPage';
import CycleTimePage from './pages/CycleTimePage';
import BottleneckPage from './pages/BottleneckPage';
import POPage from './pages/POPage';
import SCPage from './pages/SCPage';
import VendorPage from './pages/VendorPage';
import UploadPage from './pages/UploadPage';
// ─── ROOT APPLICATION ENTRY & ROUTER ──────────────────────────────────────────

function App() {
  const { activeNav, isLoading } = useDashboard();

  return (
    <ErrorBoundary>
      <div>
        <Header />
        
        <div className="main-container">
          <Sidebar />
          
          <div className="content">
            <FilterBar />

            {isLoading ? (
              <LoadingScreen />
            ) : (
              <React.Fragment>
                {activeNav === 'overview' && <OverviewPage />}
                {activeNav === 'monthday' && <MonthDayPage />}
                {activeNav === 'database' && <DatabasePage />}
                {activeNav === 'production' && <ProductionPage />}
                {activeNav === 'wip' && <WIPPage />}
                {activeNav === 'cycleTime' && <CycleTimePage />}
                {activeNav === 'bottleneck' && <BottleneckPage />}
                {activeNav === 'po' && <POPage />}
                {activeNav === 'sc' && <SCPage />}
                {activeNav === 'vendor' && <VendorPage />}
                {activeNav === 'upload' && <UploadPage />}
              </React.Fragment>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

// Mount ReactDOM root
const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
root.render(
  <DashboardProvider>
    <App />
  </DashboardProvider>
);
}
