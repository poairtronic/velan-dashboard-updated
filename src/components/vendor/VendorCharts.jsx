import React from 'react';
import useChart from '../../utils/chartUtils';

function VendorCharts({ vendors }) {
  const vendorBarRef = React.useRef();
  const vendorTimeRef = React.useRef();

  useChart(
    vendorBarRef,
    {
      type: 'bar',
      data: {
        labels: vendors.map((v) => v.code),
        datasets: [
          {
            label: 'Items Processing',
            data: vendors.map((v) => v.count),
            backgroundColor: 'rgba(0,201,255,0.3)',
            borderColor: '#00c9ff',
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#7ba7cc' } },
        },
        scales: {
          x: { ticks: { color: '#7ba7cc' }, grid: { color: 'rgba(26,58,92,0.3)' } },
          y: { ticks: { color: '#7ba7cc' }, grid: { color: 'rgba(26,58,92,0.3)' } },
        },
      },
    },
    [vendors]
  );

  useChart(
    vendorTimeRef,
    {
      type: 'bar',
      data: {
        labels: vendors.map((v) => v.code),
        datasets: [
          {
            label: 'Avg Pending Days (Today - Last Update)',
            data: vendors.map((v) => v.avgDays || 0),
            backgroundColor: vendors.map((v) =>
              (v.avgDays || 0) > 21 ? '#ff3d5a99' : '#ffd60a99'
            ),
            borderColor: vendors.map((v) => ((v.avgDays || 0) > 21 ? '#ff3d5a' : '#ffd60a')),
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: 'Max Pending Days',
            data: vendors.map((v) => v.maxDays || 0),
            backgroundColor: 'rgba(255,107,53,0.3)',
            borderColor: '#ff6b35',
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#7ba7cc' } },
          tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y} days` } },
        },
        scales: {
          x: { ticks: { color: '#7ba7cc' }, grid: { color: 'rgba(26,58,92,0.3)' } },
          y: {
            ticks: { color: '#7ba7cc' },
            grid: { color: 'rgba(26,58,92,0.3)' },
            title: { display: true, text: 'Pending Days (Today - Last Update)', color: '#7ba7cc' },
          },
        },
      },
    },
    [vendors]
  );

  return (
    <div className="chart-grid">
      <div className="chart-card">
        <div className="chart-title">Items per Vendor Operation</div>
        <div className="chart-sub">WORKLOAD BY VENDOR STAGE CODE</div>
        <div className="chart-wrap">
          <canvas ref={vendorBarRef} />
        </div>
      </div>
      <div className="chart-card">
        <div className="chart-title">⏱ Avg & Max Pending Days per Vendor Op</div>
        <div className="chart-sub">TODAY - LAST UPDATE TIMESTAMP · RED = OVER 21 DAYS</div>
        <div className="chart-wrap">
          <canvas ref={vendorTimeRef} />
        </div>
      </div>
    </div>
  );
}

export default VendorCharts;
