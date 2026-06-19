import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import VirtualizedTable from './ui/VirtualizedTable';

function DrilldownModal({ kpiType, title, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const token = localStorage.getItem('token');
    
    fetch(`/api/drilldown/${kpiType}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch drilldown data');
        return r.json();
      })
      .then(json => {
        if (isMounted) {
          setData(json);
          setLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [kpiType]);

  const renderContent = () => {
    if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading live database intelligence...</div>;
    if (error) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--danger)' }}><AlertCircle size={24} style={{ marginBottom: '10px' }}/><br/>{error}</div>;
    if (!data) return null;

    if (kpiType === 'otd') {
      return (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '20px' }}>
            <div className="chart-card" style={{ padding: '15px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>AFFECTED POs</div>
              <div style={{ fontSize: '24px', color: 'var(--danger)', fontWeight: 'bold' }}>{data.affectedPOs}</div>
            </div>
            <div className="chart-card" style={{ padding: '15px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>AFFECTED SCs</div>
              <div style={{ fontSize: '24px', color: 'var(--warning)', fontWeight: 'bold' }}>{data.affectedSCs}</div>
            </div>
            <div className="chart-card" style={{ padding: '15px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>AFFECTED VENDORS</div>
              <div style={{ fontSize: '24px', color: 'var(--text-primary)', fontWeight: 'bold' }}>{data.affectedVendors}</div>
            </div>
          </div>
          <div className="chart-card" style={{ padding: '15px' }}>
            <div className="chart-sub" style={{ marginBottom: '10px' }}>DELAY CAUSE BREAKDOWN</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Vendor Delays:</span>
              <span style={{ fontWeight: 'bold', color: 'var(--danger)' }}>{data.breakdown.vendor} items</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Inspection Delays:</span>
              <span style={{ fontWeight: 'bold', color: 'var(--warning)' }}>{data.breakdown.inspection} items</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Production Delays:</span>
              <span style={{ fontWeight: 'bold', color: 'var(--accent1)' }}>{data.breakdown.production} items</span>
            </div>
          </div>
        </div>
      );
    }

    if (kpiType === 'bottleneck' || kpiType === 'wip' || kpiType === 'production') {
      return (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '20px' }}>
            <div className="chart-card" style={{ padding: '15px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>TOP BOTTLENECK STAGE</div>
              <div style={{ fontSize: '24px', color: 'var(--danger)', fontWeight: 'bold' }}>{data.topStage}</div>
            </div>
            <div className="chart-card" style={{ padding: '15px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>AFFECTED PO COUNT</div>
              <div style={{ fontSize: '24px', color: 'var(--text-primary)', fontWeight: 'bold' }}>{data.affectedPOCount}</div>
            </div>
            <div className="chart-card" style={{ padding: '15px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CURRENT QUEUE SIZE</div>
              <div style={{ fontSize: '24px', color: 'var(--warning)', fontWeight: 'bold' }}>{data.currentQueueSize}</div>
            </div>
            <div className="chart-card" style={{ padding: '15px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>EXPECTED DELAY RISK</div>
              <div style={{ fontSize: '24px', color: 'var(--danger)', fontWeight: 'bold' }}>+{data.expectedDelayDays} Days</div>
            </div>
          </div>
        </div>
      );
    }

    if (kpiType === 'vendor') {
      return (
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <VirtualizedTable
            headers={[
              { label: 'Vendor', flex: 2 },
              { label: 'Items', flex: 1 },
              { label: 'Delayed', flex: 1 },
              { label: 'Avg Cycle', flex: 1 },
              { label: 'SLA %', flex: 1 }
            ]}
            data={data.vendors || []}
            height={350}
            itemSize={40}
            RowComponent={({ row: v }) => (
              <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
                <div style={{ flex: 2, padding: '0 12px', fontWeight: 'bold', color: 'var(--accent1)' }}>{v.vendorName}</div>
                <div style={{ flex: 1, padding: '0 12px', textAlign: 'center' }}>{v.itemCount}</div>
                <div style={{ flex: 1, padding: '0 12px', textAlign: 'center', color: v.delayedItemCount > 0 ? 'var(--danger)' : 'var(--success)' }}>{v.delayedItemCount}</div>
                <div style={{ flex: 1, padding: '0 12px', textAlign: 'center' }}>{v.avgCycleTime}d</div>
                <div style={{ flex: 1, padding: '0 12px', textAlign: 'center', color: v.sla < 80 ? 'var(--danger)' : 'var(--success)' }}>{v.sla}%</div>
              </div>
            )}
            isEmpty={!data.vendors || data.vendors.length === 0}
            emptyMessage="No vendor data available"
          />
        </div>
      );
    }

    if (kpiType === 'inventory') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div className="chart-card" style={{ padding: '15px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.1)' }}>
            <div style={{ fontSize: '11px', color: 'var(--success)' }}>READY ITEMS</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{data.READY}</div>
          </div>
          <div className="chart-card" style={{ padding: '15px', textAlign: 'center', background: 'rgba(59, 130, 246, 0.1)' }}>
            <div style={{ fontSize: '11px', color: 'var(--accent1)' }}>STORES</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{data.STORES}</div>
          </div>
          <div className="chart-card" style={{ padding: '15px', textAlign: 'center', background: 'rgba(139, 92, 246, 0.1)' }}>
            <div style={{ fontSize: '11px', color: 'var(--accent2)' }}>STOCK</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{data.STOCK}</div>
          </div>
          <div className="chart-card" style={{ padding: '15px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)' }}>
            <div style={{ fontSize: '11px', color: 'var(--danger)' }}>DEAD INVENTORY (&gt;30d NO MVT)</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--danger)' }}>{data.deadInventory}</div>
          </div>
        </div>
      );
    }

    return <div>No template for this KPI type.</div>;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }} onClick={onClose}>
      <div 
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          width: '600px',
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{title} Drilldown</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>LIVE SQL AGGREGATION</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>
        <div style={{ padding: '20px', overflowY: 'auto' }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

export default React.memo(DrilldownModal);

