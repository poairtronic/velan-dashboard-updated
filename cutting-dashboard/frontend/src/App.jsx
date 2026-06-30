import CuttingDashboard from './CuttingDashboard';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
            Production Cutting Dashboard
          </h1>
          <p className="text-gray-400 mt-2">Real-time inventory and atomic cutting transactions</p>
        </header>
        <main>
          <CuttingDashboard />
        </main>
      </div>
    </div>
  );
}

export default App;
