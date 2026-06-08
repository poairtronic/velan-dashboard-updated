import { toIsoDateString } from './dateUtils';
import { inferType, normalizeInhouse, normalizeTimestamp } from '../services/dataNormalizer';
import { resolveLatestStage } from '../services/stageResolver';

export function normalizeRow(raw) {
  if (!raw) return null;
  const product = String(raw.product || raw['Product Name'] || '').trim();
  const status1 = String(raw.status1 || '').trim();
  const status2 = String(raw.status2 || '').trim();
  const opStage = String(raw.currentStage || '').trim();
  const poRaw   = String(raw.po || '').trim();
  const poDate  = toIsoDateString(raw.poDate);
  const po      = toIsoDateString(poRaw) ? '' : poRaw;
  return {
    ...raw,
    sc: String(raw.sc || '').replace(/\s+/g,'').trim(),
    po,
    poDate,
    product,
    type: String(raw.type || '').trim().toUpperCase() || inferType(product),
    status1,
    status2,
    inhouse: normalizeInhouse(raw.inhouse),
    currentStage: resolveLatestStage({ opStage, status1, status2 }),
    timestamp: normalizeTimestamp(raw.timestamp),
  };
}
