import React, { Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { UIProvider, useUI } from './context/UIContext';
import { FilterProvider } from './context/FilterContext';
import { DataProvider } from './context/DataContext';
import ErrorBoundary from './components/ErrorBoundary';
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
      <Route path="/*" element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      } />
    </Routes>
  );
}

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
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route path="/" element={<OverviewPage />} />
                <Route path="/overview" element={<Navigate to="/" replace />} />
                <Route path="/monthday" element={<MonthDayPage />} />
                <Route path="/database" element={<DatabasePage />} />
                <Route path="/production" element={<ProductionPage />} />
                <Route path="/wip" element={<WIPPage />} />
                <Route path="/cycleTime" element={<CycleTimePage />} />
                <Route path="/bottleneck" element={<BottleneckPage />} />
                <Route path="/po" element={<POPage />} />
                <Route path="/sc" element={<SCPage />} />
                <Route path="/vendor" element={<VendorPage />} />
                <Route path="/users" element={
                  <ProtectedRoute adminOnly={true}>
                    <UserManagementPage />
                  </ProtectedRoute>
                } />
                <Route path="/upload" element={
                  <ProtectedRoute adminOnly={true}>
                    <UploadPage />
                  </ProtectedRoute>
                } />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
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
