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
  ReactDOM.render(
    <DashboardProvider>
      <App />
    </DashboardProvider>,
    rootEl
  );
}