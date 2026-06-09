import React from 'react';
import { useTheme } from '../context/ThemeContext';
// ─── CHART HELPERS ────────────────────────────────────────────────────────────

function useChart(ref, config, deps) {
  const { theme } = useTheme();
  // Store the chart instance across renders so we can reuse it
  const chartRef = React.useRef(null);
  // Track the last theme used to detect theme switches
  const lastThemeRef = React.useRef(theme);

  React.useEffect(() => {
    let isActive = true;

    async function initChart() {
      if (!ref.current) return;

      const { default: Chart } = await import('chart.js/auto');
      if (!isActive) return;

      const isLight = theme === 'light';
      const tickColor = isLight ? '#455f7b' : '#7ba7cc';
      const gridColor = isLight ? 'rgba(211, 223, 236, 0.5)' : 'rgba(26, 58, 92, 0.3)';
      const themeChanged = lastThemeRef.current !== theme;

      // Helper: apply theme colours into a config (mutates in-place)
      function applyTheme(cfg) {
        cfg.options = cfg.options || {};
        cfg.options.plugins = cfg.options.plugins || {};
        if (cfg.options.plugins.legend) {
          cfg.options.plugins.legend.labels = cfg.options.plugins.legend.labels || {};
          cfg.options.plugins.legend.labels.color = tickColor;
        }
        if (cfg.options.scales) {
          Object.keys(cfg.options.scales).forEach(key => {
            const scale = cfg.options.scales[key];
            scale.ticks = scale.ticks || {};
            scale.ticks.color = tickColor;
            scale.grid = scale.grid || {};
            scale.grid.color = gridColor;
          });
        }
      }

      const existing = chartRef.current;
      const typeMatch = existing && existing.config.type === config.type;

      // ── REUSE PATH: same chart type, no theme change ─────────────────────────
      if (existing && typeMatch && !themeChanged) {
        // Update datasets in-place without destroying the instance
        existing.data.labels = config.data.labels;
        existing.data.datasets.forEach((ds, i) => {
          if (config.data.datasets[i]) {
            Object.assign(ds, config.data.datasets[i]);
          }
        });
        // Handle dataset count changes (more/fewer datasets)
        if (config.data.datasets.length !== existing.data.datasets.length) {
          existing.data.datasets = config.data.datasets;
        }
        // 'none' mode skips animation for snappy filter response
        existing.update('none');
        return;
      }

      // ── RECREATE PATH: first mount, type change, or theme change ─────────────
      lastThemeRef.current = theme;
      if (existing) {
        try { existing.destroy(); } catch (_) {}
        chartRef.current = null;
      }

      applyTheme(config);
      const ctx = ref.current.getContext('2d');
      chartRef.current = new Chart(ctx, config);
    }

    initChart();

    // Cleanup only on unmount
    return () => {
      isActive = false;
      if (chartRef.current) {
        try { chartRef.current.destroy(); } catch (_) {}
        chartRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, theme]);
}

export default useChart;