import { apiBase, apiClient } from './apiClient';

export async function loadConfig() {
  const res = await apiClient(`${apiBase}/api/config`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}
