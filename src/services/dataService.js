import { apiBase, apiClient } from './apiClient';

export async function fetchData() {
  const res = await apiClient(`${apiBase}/api/data`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function saveRows(rows, syncType = 'Manual Upload') {
  const headers = { 'Content-Type': 'application/json' };

  const res = await apiClient(`${apiBase}/api/data?sync_type=${encodeURIComponent(syncType)}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ rows }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function importRows(rows) {
  const headers = { 'Content-Type': 'application/json' };

  const res = await apiClient(`${apiBase}/api/import`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ rows }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function resetDB() {
  const headers = {};

  const res = await apiClient(`${apiBase}/api/data`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}
