export async function fetchAlerts(status) {
  const url = status ? `/api/alerts?status=${status}` : '/api/alerts';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
}

export async function markAlertsRead(ids) {
  const res = await fetch('/api/alerts/read', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ids ? { ids } : { all: true })
  });
  if (!res.ok) throw new Error('Failed to update alerts');
  return res.json();
}

export async function fetchTimeline() {
  const res = await fetch('/api/timeline');
  if (!res.ok) throw new Error('Failed to fetch timeline');
  return res.json();
}

export async function fetchAlertRules() {
  const res = await fetch('/api/alerts/rules');
  if (!res.ok) throw new Error('Failed to fetch rules');
  return res.json();
}

export async function updateAlertRules(rules) {
  const res = await fetch('/api/alerts/rules', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules })
  });
  if (!res.ok) throw new Error('Failed to update rules');
  return res.json();
}
