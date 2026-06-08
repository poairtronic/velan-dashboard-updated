import React from 'react';
import Chart from 'chart.js/auto';
import { useDashboard } from '../context/DashboardContext';
// ─── CHART HELPERS ────────────────────────────────────────────────────────────

function useChart(ref, config, deps) {
  const { theme } = useDashboard();

  React.useEffect(() => {
    if (!ref.current) return;
    const existing = Chart.getChart(ref.current);
    if (existing) existing.destroy();

    const isLight = theme === 'light';
    const tickColor = isLight ? '#455f7b' : '#7ba7cc';
    const gridColor = isLight ? 'rgba(211, 223, 236, 0.5)' : 'rgba(26, 58, 92, 0.3)';

    // Adjust chart options to match active theme colors
    config.options = config.options || {};
    config.options.plugins = config.options.plugins || {};
    
    if (config.options.plugins.legend) {
      config.options.plugins.legend.labels = config.options.plugins.legend.labels || {};
      config.options.plugins.legend.labels.color = tickColor;
    }

    if (config.options.scales) {
      Object.keys(config.options.scales).forEach(key => {
        const scale = config.options.scales[key];
        scale.ticks = scale.ticks || {};
        scale.ticks.color = tickColor;

        scale.grid = scale.grid || {};
        scale.grid.color = gridColor;
      });
    }

    const ctx = ref.current.getContext('2d');
    const chart = new Chart(ctx, config);
    return () => {
      try {
        chart.destroy();
      } catch (_) {}
    };
  }, [...deps, theme]);
}

export default useChart;