import { normalizeStage } from './dataNormalizer';
// ─── STAGE RESOLUTION SERVICES ───────────────────────────────────────────────

function extractStageFromStatusText(text) {
  const t = String(text || '').toUpperCase().trim();
  if (!t) return '';

  const moveMatch = t.match(/MOVE\s*TO\s*([A-Z0-9]+)/);
  if (moveMatch && moveMatch[1]) return normalizeStage(moveMatch[1]);

  if (/\bSTOCK\b/.test(t)) return 'STOCK';
  if (/\bSTORES?\b/.test(t)) return 'STORES';
  if (/\bREADY\b/.test(t)) return 'READY';

  const knownStages = [
    'LATHE','M1','FB','HT','SZ','BLK','CG','SG','SD','HO',
    'CA','WC','VA','QC','DCPLI','FBV','BLV','SDV','HOV','HTV','HCV','RM'
  ];
  for (const stage of knownStages) {
    if (t.includes(stage)) return normalizeStage(stage);
  }
  return '';
}

function resolveLatestStage({ opStage, status1, status2 }) {
  // OP column is primary — use it if it resolves to a known stage
  const fromOp = normalizeStage(opStage);
  if (fromOp) return fromOp;

  // OP column empty/unresolved — fall back to free-text status fields
  return (
    extractStageFromStatusText(status2) ||
    extractStageFromStatusText(status1) ||
    ''
  );
}

export { extractStageFromStatusText, resolveLatestStage };