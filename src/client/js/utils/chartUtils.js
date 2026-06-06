// ─── CHART HELPERS ────────────────────────────────────────────────────────────

function useChart(ref, config, deps) {
  React.useEffect(() => {
    if (!ref.current) return;
    const existing = Chart.getChart(ref.current);
    if (existing) existing.destroy();
    const ctx = ref.current.getContext('2d');
    const chart = new Chart(ctx, config);
    return () => {
      try {
        chart.destroy();
      } catch (_) {}
    };
  }, deps);
}
