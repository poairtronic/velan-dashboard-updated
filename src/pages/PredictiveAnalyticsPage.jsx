import React from 'react';
import BottleneckForecast from '../components/forecasting/BottleneckForecast';
import SLAForecastPanel from '../components/forecasting/SLAForecastPanel';
import CapacityPlanner from '../components/forecasting/CapacityPlanner';
import QueueForecastCard from '../components/forecasting/QueueForecastCard';
import VendorRiskMatrix from '../components/forecasting/VendorRiskMatrix';
import PlantRiskDashboard from '../components/forecasting/PlantRiskDashboard';

function PredictiveAnalyticsPage() {
  return (
    <div>
      {/* Page Title */}
      <div className="section-title">
        <span>🔮</span> PREDICTIVE ANALYTICS
        <div className="section-line" />
      </div>

      {/* Section 0: Plant Risk Intelligence (Section 4 + 5 — full width, top of page) */}
      <div style={{ marginBottom: 20 }}>
        <PlantRiskDashboard />
      </div>

      {/* Section 1: Bottleneck Forecast (full width) */}
      <div style={{ marginBottom: 20 }}>
        <BottleneckForecast />
      </div>

      {/* Section 2: SLA Forecast (full width table) */}
      <div style={{ marginBottom: 20 }}>
        <SLAForecastPanel />
      </div>

      {/* Section 3: Capacity Planner + Queue Forecast (2-column grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <CapacityPlanner />
        <QueueForecastCard />
      </div>

      {/* Section 4: Vendor Risk Matrix (full width) */}
      <div style={{ marginBottom: 20 }}>
        <VendorRiskMatrix />
      </div>

      {/* Data Basis Footer */}
      <div style={{
        padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
          All forecasts derived from historical production data · No hardcoded rates or assumptions
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
          Confidence scores reflect data availability · V3 Model: Activity(40%) + Consistency(30%) + Volume(30%)
        </span>
      </div>
    </div>
  );
}

export default PredictiveAnalyticsPage;
