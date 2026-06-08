import React, { Suspense } from 'react';
import { useDashboard } from './context/DashboardContext';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import FilterBar from './components/FilterBar';
import LoadingScreen from './components/LoadingScreen';

// Lazy-loaded page components
const OverviewPage = React.lazy(() => import('./pages/OverviewPage'));
const MonthDayPage = React.lazy(() => import('./pages/MonthDayPage'));
const DatabasePage = React.lazy(() => import('./pages/DatabasePage'));
const ProductionPage = React.lazy(() => import('./pages/ProductionPage'));
const WIPPage = React.lazy(() => import('./pages/WIPPage'));
const CycleTimePage = React.lazy(() => import('./pages/CycleTimePage'));
const BottleneckPage = React.lazy(() => import('./pages/BottleneckPage'));
const POPage = React.lazy(() => import('./pages/POPage'));
const SCPage = React.lazy(() => import('./pages/SCPage'));
const VendorPage = React.lazy(() => import('./pages/VendorPage'));
const UploadPage = React.lazy(() => import('./pages/UploadPage'));

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
              <Suspense fallback={<LoadingScreen />}>
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
              </Suspense>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;
