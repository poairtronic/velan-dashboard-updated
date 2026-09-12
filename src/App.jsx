import React, { Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { UIProvider, useUI } from './context/UIContext';
import { FilterProvider } from './context/FilterContext';
import { DataProvider } from './context/DataContext';
import ErrorBoundary from './components/ErrorBoundary';
import { Toaster } from 'react-hot-toast';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import FilterBar from './components/FilterBar';
import LoadingScreen from './components/LoadingScreen';
import CommandPalette from './components/CommandPalette';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import { useWebSocket } from './hooks/useWebSocket';

// Lazy-loaded page components
const OverviewPage = React.lazy(() => import('./pages/OverviewPage'));
const ExecutivePage = React.lazy(() => import('./pages/ExecutivePage'));
const ExecutiveWarRoom = React.lazy(() => import('./pages/ExecutiveWarRoom'));
const ManufacturingIntelligencePage = React.lazy(() => import('./pages/ManufacturingIntelligencePage'));
const EnterpriseHealthPage = React.lazy(() => import('./pages/EnterpriseHealthPage'));
const MonthDayPage = React.lazy(() => import('./pages/MonthDayPage'));
const DatabasePage = React.lazy(() => import('./pages/DatabasePage'));
const ProductionPage = React.lazy(() => import('./pages/ProductionPage'));
const WIPPage = React.lazy(() => import('./pages/WIPPage'));
const CycleTimePage = React.lazy(() => import('./pages/CycleTimePage'));
const BottleneckPage = React.lazy(() => import('./pages/BottleneckPage'));
const POPage = React.lazy(() => import('./pages/POPage'));
const SCPage = React.lazy(() => import('./pages/SCPage'));
const SalesProjectionPage = React.lazy(() => import('./pages/SalesProjectionPage'));
const VendorPage = React.lazy(() => import('./pages/VendorPage'));
const UploadPage = React.lazy(() => import('./pages/UploadPage'));
const UserManagementPage = React.lazy(() => import('./pages/UserManagementPage'));
const PredictiveAnalyticsPage = React.lazy(() => import('./pages/PredictiveAnalyticsPage'));
const InventoryPage = React.lazy(() => import('./pages/InventoryPage'));

const AuditTrailViewer = React.lazy(() => import('./pages/AuditTrailViewer'));

function AppRoutes() {
  const { setActiveNav } = useUI();
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname.split('/')[1];
    if (path && path !== 'login') {
      setActiveNav(path);
    } else if (!path) {
      setActiveNav('overview');
    }
  }, [location.pathname, setActiveNav]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

const RouteWrapper = ({ children }) => (
  <ErrorBoundary>
    <Suspense fallback={<LoadingScreen />}>{children}</Suspense>
  </ErrorBoundary>
);

function DashboardLayout() {
  const { isLoading } = useUI();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Initialize live WebSocket subscription
  useWebSocket();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div>
      <Header onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} />
      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />

      <div className="main-container">
        <Sidebar />

        <div className="content">
          <FilterBar />

          {isLoading ? (
            <LoadingScreen />
          ) : (
            <Routes>
              <Route
                path="/"
                element={
                  <ProtectedRoute moduleId="overview">
                    <RouteWrapper>
                      <OverviewPage />
                    </RouteWrapper>
                  </ProtectedRoute>
                }
              />
              <Route path="/overview" element={<Navigate to="/" replace />} />
              <Route
                path="/executive"
                element={
                  <ProtectedRoute moduleId="executive">
                    <RouteWrapper>
                      <ExecutivePage />
                    </RouteWrapper>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/executive-war-room"
                element={
                  <ProtectedRoute moduleId="executive-war-room">
                    <RouteWrapper>
                      <ExecutiveWarRoom />
                    </RouteWrapper>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/mic"
                element={
                  <ProtectedRoute moduleId="mic">
                    <RouteWrapper>
                      <ManufacturingIntelligencePage />
                    </RouteWrapper>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/forecast"
                element={
                  <ProtectedRoute moduleId="forecast">
                    <RouteWrapper>
                      <PredictiveAnalyticsPage />
                    </RouteWrapper>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory"
                element={
                  <ProtectedRoute moduleId="inventory">
                    <RouteWrapper>
                      <InventoryPage />
                    </RouteWrapper>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/health"
                element={
                  <ProtectedRoute adminOnly={true}>
                    <RouteWrapper>
                      <EnterpriseHealthPage />
                    </RouteWrapper>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/monthday"
                element={
                  <ProtectedRoute moduleId="monthday">
                    <RouteWrapper>
                      <MonthDayPage />
                    </RouteWrapper>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/database"
                element={
                  <ProtectedRoute moduleId="database">
                    <RouteWrapper>
                      <DatabasePage />
                    </RouteWrapper>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/production"
                element={
                  <ProtectedRoute moduleId="production">
                    <RouteWrapper>
                      <ProductionPage />
                    </RouteWrapper>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/wip"
                element={
                  <ProtectedRoute moduleId="wip">
                    <RouteWrapper>
                      <WIPPage />
                    </RouteWrapper>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/cycleTime"
                element={
                  <ProtectedRoute moduleId="cycleTime">
                    <RouteWrapper>
                      <CycleTimePage />
                    </RouteWrapper>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bottleneck"
                element={
                  <ProtectedRoute moduleId="bottleneck">
                    <RouteWrapper>
                      <BottleneckPage />
                    </RouteWrapper>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/po"
                element={
                  <ProtectedRoute moduleId="po">
                    <RouteWrapper>
                      <POPage />
                    </RouteWrapper>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sc"
                element={
                  <ProtectedRoute moduleId="sc">
                    <RouteWrapper>
                      <SCPage />
                    </RouteWrapper>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sales-projection"
                element={
                  <ProtectedRoute moduleId="sales-projection">
                    <RouteWrapper>
                      <SalesProjectionPage />
                    </RouteWrapper>
                  </ProtectedRoute>
                }
              />
              <Route path="/sales" element={<Navigate to="/sales-projection" replace />} />
              <Route
                path="/vendor"
                element={
                  <ProtectedRoute moduleId="vendor">
                    <RouteWrapper>
                      <VendorPage />
                    </RouteWrapper>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/users"
                element={
                  <ProtectedRoute adminOnly={true}>
                    <RouteWrapper>
                      <UserManagementPage />
                    </RouteWrapper>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/upload"
                element={
                  <ProtectedRoute adminOnly={true}>
                    <RouteWrapper>
                      <UploadPage />
                    </RouteWrapper>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/audit-trail"
                element={
                  <ProtectedRoute adminOnly={true}>
                    <RouteWrapper>
                      <AuditTrailViewer />
                    </RouteWrapper>
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#050b14',
            color: '#e2e8f0',
            border: '1px solid rgba(0,201,255,0.2)',
            fontFamily: 'Share Tech Mono, monospace',
          },
          success: {
            iconTheme: { primary: '#00c9ff', secondary: '#050b14' },
          },
          error: {
            iconTheme: { primary: '#ff3d5a', secondary: '#050b14' },
          },
        }}
      />
      <AuthProvider>
        <ThemeProvider>
          <UIProvider>
            <FilterProvider>
              <DataProvider>
                <AppRoutes />
              </DataProvider>
            </FilterProvider>
          </UIProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
