import { toIsoDateString } from './dateUtils';
import { inferType, normalizeInhouse, normalizeTimestamp } from '../services/dataNormalizer';
import { resolveLatestStage } from '../services/stageResolver';
import { calculateEstimatedDelivery, calculateProductProjectedDate } from './calculationUtils.js';

export function normalizeRow(raw) {
  if (!raw) return null;
  const product = String(raw.product || raw['Product Name'] || raw['PRODUCT'] || '').trim();
  const status1 = String(raw.status1 || raw['STATUS 1'] || raw['Status 1'] || '').trim();
  const status2 = String(raw.status2 || raw['STATUS 2'] || raw['Status 2'] || '').trim();
  const opStage = String(raw.currentStage || raw.op || raw['OP'] || raw['Current Stage'] || '').trim();
  const poRaw = String(raw.po || raw['PO NO'] || raw['PO'] || '').trim();
  const poDate = toIsoDateString(raw.poDate || raw['PO RECEIVED DATE'] || raw['PO Date'] || raw['PO RECEIVED']);
  const po = toIsoDateString(poRaw) ? '' : poRaw;
  const type =
    String(raw.type || raw['Type'] || '')
      .trim()
      .toUpperCase() || inferType(product);
  const family =
    String(raw.family || raw['FAMILY'] || raw['Family'] || '')
      .trim()
      .toUpperCase() || type;
  const template = String(
    raw.template || raw.processTemplate || raw['PROCESS TEMPLATE'] || raw['Template'] || ''
  ).trim();

  let projectedDate = toIsoDateString(
    raw.projectedDate ||
      raw['PROJECTED DATE'] ||
      raw['Projected Date'] ||
      raw['projected_date'] ||
      raw['targetDate'] ||
      raw['TARGET DATE'] ||
      raw['target_date'] ||
      ''
  );

  let estimatedDelivery = toIsoDateString(
    raw.estimatedDelivery ||
      raw['ESTIMATED DELIVERY DATE'] ||
      raw['Estimated Delivery Date'] ||
      raw['ESTIMATED DELIVERY'] ||
      raw['Estimated Delivery'] ||
      raw['estimated_delivery'] ||
      ''
  );

  const timestamp = normalizeTimestamp(
    raw.timestamp ||
      raw['OP UPDATED DATE'] ||
      raw['OP Updated Date'] ||
      raw['op_updated_date'] ||
      raw['OP UPDATE DATE'] ||
      raw['OP UPDATED'] ||
      raw['OP Date'] ||
      raw['OP DATE'] ||
      raw['Timestamp'] ||
      raw['TIMESTAMP'] ||
      raw['Time Stamp'] ||
      raw['TIME STAMP'] ||
      raw['LAST UPDATED'] ||
      raw['Last Updated'] ||
      raw['LAST UPDATE'] ||
      raw['Last Update'] ||
      raw['Updated Date'] ||
      raw['Update Date'] ||
      raw['UPDATED DATE'] ||
      raw['UPDATE DATE'] ||
      raw['Date Time'] ||
      raw['DATETIME'] ||
      raw['DateTime'] ||
      raw['OP Time'] ||
      raw['OP TIME'] ||
      raw['Stage Date'] ||
      raw['STAGE DATE'] ||
      raw['Status Date'] ||
      raw['STATUS DATE'] ||
      raw['Entry Date'] ||
      raw['ENTRY DATE'] ||
      raw['TIME'] ||
      raw['Time']
  );

  // Dynamic fallback calculation for estimated delivery if not in raw data
  if (!estimatedDelivery && poDate) {
    const est = calculateEstimatedDelivery(poDate, family || type);
    if (est && est.date) estimatedDelivery = est.date;
  }

  // Dynamic fallback shifting calculation for projected date if not in raw data
  if (!projectedDate && (poDate || timestamp)) {
    const proj = calculateProductProjectedDate({
      product,
      type,
      family,
      template,
      currentStage: opStage || status1,
      timestamp,
      poDate,
    });
    if (proj && proj.projectedDate) projectedDate = proj.projectedDate;
  }

  return {
    ...raw,
    sc: String(raw.sc || raw['SC NO'] || raw['SC'] || '')
      .replace(/\s+/g, '')
      .trim(),
    po,
    poDate,
    family,
    template,
    projectedDate,
    estimatedDelivery,
    product,
    type,
    status1,
    status2,
    inhouse: normalizeInhouse(raw.inhouse || raw['INHOUSE/VENDOR'] || raw['Inhouse']),
    currentStage: resolveLatestStage({ opStage, status1, status2 }),
    timestamp,
  };
}
