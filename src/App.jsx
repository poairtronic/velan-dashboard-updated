import React, { Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { UIProvider, useUI } from './context/UIContext';
import { FilterProvider } from './context/FilterContext';
import { DataProvider } from './context/DataContext';
import AppErrorBoundary from './components/common/AppErrorBoundary';
import { Toaster } from 'react-hot-toast';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import FilterBar from './components/FilterBar';
import LoadingScreen from './components/LoadingScreen';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';

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
const UserManagementPage = React.lazy(() => import('./pages/UserManagementPage'));

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
  <AppErrorBoundary>
    <Suspense fallback={<LoadingScreen />}>{children}</Suspense>
  </AppErrorBoundary>
);

function DashboardLayout() {
  const { isLoading } = useUI();

  return (
    <div>
      <Header />

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
                  <RouteWrapper>
                    <OverviewPage />
                  </RouteWrapper>
                }
              />
              <Route path="/overview" element={<Navigate to="/" replace />} />
              <Route
                path="/monthday"
                element={
                  <RouteWrapper>
                    <MonthDayPage />
                  </RouteWrapper>
                }
              />
              <Route
                path="/database"
                element={
                  <RouteWrapper>
                    <DatabasePage />
                  </RouteWrapper>
                }
              />
              <Route
                path="/production"
                element={
                  <RouteWrapper>
                    <ProductionPage />
                  </RouteWrapper>
                }
              />
              <Route
                path="/wip"
                element={
                  <RouteWrapper>
                    <WIPPage />
                  </RouteWrapper>
                }
              />
              <Route
                path="/cycleTime"
                element={
                  <RouteWrapper>
                    <CycleTimePage />
                  </RouteWrapper>
                }
              />
              <Route
                path="/bottleneck"
                element={
                  <RouteWrapper>
                    <BottleneckPage />
                  </RouteWrapper>
                }
              />
              <Route
                path="/po"
                element={
                  <RouteWrapper>
                    <POPage />
                  </RouteWrapper>
                }
              />
              <Route
                path="/sc"
                element={
                  <RouteWrapper>
                    <SCPage />
                  </RouteWrapper>
                }
              />
              <Route
                path="/vendor"
                element={
                  <RouteWrapper>
                    <VendorPage />
                  </RouteWrapper>
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
    <AppErrorBoundary>
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
    </AppErrorBoundary>
  );
}

export default App;
