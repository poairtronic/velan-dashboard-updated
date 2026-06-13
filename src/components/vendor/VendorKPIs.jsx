import React from 'react';
import KPICard from '../KPICard';

function VendorKPIs({ kpis, vendors, worstVendor, mostDelayed, inhPct, venPct }) {
  return (
    <div className="kpi-grid">
      <KPICard
        label="INHOUSE ITEMS"
        value={kpis.inhouse}
        sub={`${inhPct}% of total`}
        color1="#00c9ff"
        color2="#0fa8e0"
      />
      <KPICard
        label="VENDOR ITEMS"
        value={kpis.vendor}
        sub={`${venPct}% of total`}
        color1="#b24bff"
        color2="#ff6b35"
      />
      <KPICard
        label="VENDOR STAGES"
        value={vendors.length}
        sub="distinct vendor operations"
        color1="#ffd60a"
        color2="#b24bff"
      />
      <KPICard
        label="SLOWEST VENDOR OP"
        value={worstVendor?.code || '—'}
        sub={`~${worstVendor?.avgDays || 0} days since last update`}
        color1="#ff3d5a"
        color2="#ff6b35"
        badge={{ text: 'HIGHEST AGING', cls: 'badge-red' }}
      />
      <KPICard
        label="MOST DELAYED"
        value={mostDelayed?.code || '—'}
        sub={`${mostDelayed?.delayed || 0} items >21 days pending`}
        color1="#ff3d5a"
        color2="#b24bff"
        badge={{ text: 'DELAYED', cls: 'badge-red' }}
      />
      <KPICard
        label="TOTAL VENDOR"
        value={kpis.inhouse + kpis.vendor}
        sub="all items tracked"
        color1="#00ff9d"
        color2="#00c9ff"
      />
    </div>
  );
}

export default VendorKPIs;
