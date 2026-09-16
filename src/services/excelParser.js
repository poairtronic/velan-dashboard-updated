import { toIsoDateString } from '../utils/dateUtils';
import { normalizeInhouse, inferType, normalizeTimestamp } from './dataNormalizer';
import { resolveLatestStage } from './stageResolver';
// ─── EXCEL & CSV PARSER SERVICES ─────────────────────────────────────────────

// Raw CSV parser to preserve original DD/MM date strings and prevent sheetJS date flipping
function parseRawCsv(text) {
  const rows = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = [];
    let inQuote = false,
      cell = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') {
          cell += '"';
          i++;
        } // escaped ""
        else {
          inQuote = !inQuote;
        }
      } else if (ch === ',' && !inQuote) {
        cells.push(cell.trim());
        cell = '';
      } else {
        cell += ch;
      }
    }
    cells.push(cell.trim());
    rows.push(cells);
  }
  return rows;
}

// Parse Velan-specific Excel format (merged cells / PO groups / stdtrack sheet)
function parseVelanExcel(rows) {
  const result = [];
  let currentPO = '',
    currentPODate = '',
    currentSC = '',
    currentStage = '';

  for (const row of rows) {
    const v = (i) => {
      const val = row[i];
      if (val === undefined || val === null) return null;
      if (val instanceof Date) return val;
      const s = String(val).trim();
      return s === '' || s === 'nan' ? null : s;
    };

    // Skip header rows and title rows
    const col1 = v(1);
    const col5 = v(5);
    if (!col5 || col5 === 'Product Name' || col5 === 'Customer Name') continue;
    if (col1 && (col1.includes('VELAN') || col1 === 'PO NO')) continue;

    // Update running PO and date if present in this row
    if (col1 && col1 !== 'NaN' && !col1.includes('SETS') && !col1.match(/^\d{4}/)) currentPO = col1;
    const col3Date = v(3);
    const col2Date = v(2);
    const parsedPODate = toIsoDateString(col3Date) || toIsoDateString(col2Date);
    if (parsedPODate) currentPODate = parsedPODate;

    // SC normalization
    const col4 = v(4);
    const col3 = v(3);
    const scCandidate = col4 || col3;
    if (scCandidate && !String(scCandidate).toUpperCase().includes('SET') && !toIsoDateString(scCandidate)) {
      currentSC = String(scCandidate).replace(/\s+/g, '');
    }

    const product = col5;
    const status1 = v(7) || '';
    const status2 = v(8) || '';
    const inhouseRaw = v(9) || 'INHOUSE';
    const inhouse = normalizeInhouse(inhouseRaw);
    const stageRaw = v(10);
    const tsRaw = v(11) || '';
    const timestamp = normalizeTimestamp(tsRaw);
    const familyRaw = v(12) || '';
    const templateRaw = v(13) || '';
    const projectedDateRaw = v(14) || v(15) || '';
    const projectedDate = toIsoDateString(projectedDateRaw);
    const estimatedDeliveryRaw = v(16) || v(17) || '';
    const estimatedDelivery = toIsoDateString(estimatedDeliveryRaw);

    const type = familyRaw ? String(familyRaw).trim().toUpperCase() : inferType(product);
    const latestStage = resolveLatestStage({ opStage: stageRaw, status1, status2 });
    if (latestStage) currentStage = latestStage;

    if (currentSC && product) {
      result.push({
        sc: currentSC,
        po: currentPO,
        poDate: currentPODate,
        family: familyRaw ? String(familyRaw).trim().toUpperCase() : type,
        template: templateRaw ? String(templateRaw).trim() : '',
        projectedDate,
        estimatedDelivery,
        product,
        type,
        status1,
        status2,
        inhouse,
        currentStage: latestStage || currentStage || '',
        timestamp,
      });
    }
  }
  return result;
}

// Flat-row parser (generic CSV/Excel with headers)
function parseGenericRows(rows) {
  const norm = (s) =>
    String(s || '')
      .replace(/[\s/\-_]+/g, '')
      .toLowerCase();
  const pickField = (r, candidates) => {
    for (const c of candidates) {
      const val = r[norm(c)];
      if (val !== undefined && val !== null && String(val).trim() !== '') return String(val).trim();
    }
    for (const c of candidates) {
      const word = norm(c);
      for (const k of Object.keys(r)) {
        if (
          norm(k).includes(word) &&
          r[k] !== undefined &&
          r[k] !== null &&
          String(r[k]).trim() !== ''
        )
          return String(r[k]).trim();
      }
    }
    return '';
  };
  const normalizeHeaders = (row) => {
    const n = {};
    Object.entries(row).forEach(([k, v]) => {
      n[norm(k)] = v;
    });
    return n;
  };
  return rows
    .map((raw) => {
      const r = normalizeHeaders(raw);
      const product = pickField(r, [
        'product name',
        'productname',
        'product',
        'item description',
        'description',
      ]);
      const typeRaw = pickField(r, ['type', 'product type', 'producttype', 'dtype']);
      const type = typeRaw || inferType(product);
      const inhouseRaw = pickField(r, [
        'inhouse/ vendor',
        'inhouse/vendor',
        'inhousevendor',
        'inhouse vendor',
        'inhouse',
        'location',
        'vendor status',
      ]);
      const inhouse = normalizeInhouse(inhouseRaw);
      const status1 = pickField(r, ['status 1', 'status1', 'current operation', 'operation']);
      const status2 = pickField(r, ['status 2', 'status2', 'next operation']);
      const opStage = pickField(r, [
        'currentstage',
        'current stage',
        'stage',
        'operation stage',
        'current operation',
        'op',
      ]);
      const projectedDate = toIsoDateString(
        pickField(r, [
          'projected date',
          'projecteddate',
          'projected',
          'mfg due date',
          'mfgduedate',
          'target completion',
          'targetcompletion',
          'target date',
          'targetdate',
          'due date',
          'duedate',
          'expected completion',
          'expected completion date',
          'product projected date',
          'productprojecteddate',
        ])
      );
      const familyRaw = pickField(r, ['family', 'product family', 'productfamily', 'family name']);
      const templateRaw = pickField(r, [
        'process template',
        'processtemplate',
        'template',
        'process type',
        'processtype',
      ]);
      const estimatedDelivery = toIsoDateString(
        pickField(r, [
          'estimated delivery date',
          'estimateddeliverydate',
          'estimated delivery',
          'estimateddelivery',
          'est delivery',
          'estdelivery',
          'delivery date',
          'deliverydate',
        ])
      );
      return {
        sc: pickField(r, ['sc', 'sc no', 'sc#', 'scno']).replace(/\s+/g, ''),
        po: pickField(r, ['po no', 'pono', 'purchase order', 'purchaseorder']),
        poDate: toIsoDateString(
          pickField(r, ['po recd date', 'porecddate', 'po date', 'podate', 'date received', 'date'])
        ),
        family: familyRaw ? familyRaw.toUpperCase() : type,
        template: templateRaw,
        projectedDate,
        estimatedDelivery,
        product,
        type,
        status1,
        status2,
        inhouse,
        currentStage: resolveLatestStage({ opStage, status1, status2 }),
        timestamp: normalizeTimestamp(
          pickField(r, [
            'timestamp',
            'time stamp',
            'op updated date',
            'op update date',
            'op updated',
            'op date',
            'last updated',
            'last update',
            'last updated date',
            'updated date',
            'update date',
            'updated at',
            'updated on',
            'op time',
            'date time',
            'datetime',
            'stage date',
            'status date',
            'entry date',
            'time',
          ])
        ),
      };
    })
    .filter((r) => r.sc || r.po);
}

// Maps spreadsheet array of arrays to keys matching database expectations
function parseRowsFromHeaderAoA(rawAoA) {
  if (!Array.isArray(rawAoA) || rawAoA.length === 0) return [];

  const norm = (s) =>
    String(s || '')
      .replace(/[\s/\-_]+/g, '')
      .toLowerCase();

  const findColumn = (row, exactAliases, containsAliases = []) => {
    const normalized = row.map((c) => norm(c));
    for (let i = 0; i < normalized.length; i++) {
      if (exactAliases.includes(normalized[i])) return i;
    }
    for (let i = 0; i < normalized.length; i++) {
      if (containsAliases.some((a) => normalized[i].includes(a))) return i;
    }
    return undefined;
  };
  let headerRowIdx = -1;
  let headerMap = {};

  for (let i = 0; i < Math.min(rawAoA.length, 40); i++) {
    const row = rawAoA[i] || [];
    const probe = {
      sc: findColumn(row, ['sc', 'scno', 'sc#']),
      po: findColumn(row, ['po', 'pono', 'purchaseorder', 'po#', 'ponumber'], ['pono', 'purchaseorder']),
      poDate: findColumn(row, ['porecddate', 'podate', 'datereceived', 'date', 'poreceiveddate', 'poreceived'], ['porecd', 'podate', 'poreceived']),
      product: findColumn(
        row,
        ['productname', 'product', 'itemdescription', 'description'],
        ['productname', 'itemdescription']
      ),
      status1: findColumn(row, ['status1', 'currentoperation', 'operation'], ['status1']),
      status2: findColumn(row, ['status2', 'nextoperation'], ['status2']),
      inhouse: findColumn(
        row,
        ['inhousevendor', 'inhouse', 'location', 'vendorstatus'],
        ['inhousevendor']
      ),
      op: findColumn(
        row,
        ['op', 'currentstage', 'stage', 'operationstage'],
        ['currentstage', 'operationstage']
      ),
      timestamp: findColumn(
        row,
        [
          'timestamp',
          'lastupdated',
          'optime',
          'datetime',
          'opupdateddate',
          'opupdated',
          'opupdatedate',
          'opdate',
          'updateddate',
          'updatedate',
          'updatedat',
          'updatedon',
          'lastupdate',
          'lastupdateddate',
          'stagedate',
          'statusdate',
          'entrydate',
          'time',
          'timestmp',
          'dateandtime',
          'operationdate',
          'operationupdateddate',
          'logdate',
          'modifieddate',
        ],
        [
          'timestamp',
          'lastupdate',
          'opupdate',
          'optime',
          'updateddate',
          'stagedate',
          'statusdate',
          'datetime',
          'entrydate',
          'opdate',
        ]
      ),
      family: findColumn(row, ['family', 'productfamily', 'familyname']),
      template: findColumn(row, ['processtemplate', 'template', 'processtype']),
      projectedDate: findColumn(
        row,
        [
          'projecteddate',
          'projected date',
          'projected',
          'mfgduedate',
          'mfg due date',
          'targetcompletion',
          'target completion',
          'targetdate',
          'target date',
          'duedate',
          'due date',
          'expectedcompletion',
          'expected completion',
          'expected completion date',
          'productprojecteddate',
          'product projected date',
        ],
        ['projecteddate', 'projected', 'mfgdue', 'targetcompletion', 'expectedcompletion']
      ),
      estimatedDelivery: findColumn(
        row,
        [
          'estimateddeliverydate',
          'estimated delivery date',
          'estimateddelivery',
          'estimated delivery',
          'estdelivery',
          'est delivery',
          'deliverydate',
          'delivery date',
        ],
        ['estimateddelivery', 'estdelivery']
      ),
    };

    if (
      probe.sc !== undefined &&
      probe.product !== undefined &&
      (probe.po !== undefined || probe.poDate !== undefined)
    ) {
      headerRowIdx = i;
      headerMap = probe;
      break;
    }
  }

  if (headerRowIdx < 0) return [];

  // Fallback for timestamp if header was missing, blank, or unrecognized
  if (headerMap.timestamp === undefined) {
    const isDateLike = (val) => {
      if (!val) return false;
      if (val instanceof Date && !isNaN(val.getTime())) return true;
      const s = String(val).trim();
      if (!s) return false;
      return (
        /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(s) ||
        /^\d{1,2}[- /][a-zA-Z]{3,9}[- /]\d{2,4}/.test(s) ||
        (!isNaN(Number(s)) && Number(s) > 20000 && Number(s) < 80000)
      );
    };

    const maxCols = Math.max(...rawAoA.slice(headerRowIdx, headerRowIdx + 10).map((r) => (r ? r.length : 0)));
    const knownCols = new Set(Object.values(headerMap).filter((v) => v !== undefined));

    const candidates = [];
    if (headerMap.op !== undefined && headerMap.op + 1 < maxCols && !knownCols.has(headerMap.op + 1)) {
      candidates.push(headerMap.op + 1);
    }
    if (maxCols > 11 && !knownCols.has(11)) {
      candidates.push(11);
    }
    for (let c = 0; c < maxCols; c++) {
      if (!knownCols.has(c) && !candidates.includes(c)) {
        candidates.push(c);
      }
    }

    for (const c of candidates) {
      let dateMatchCount = 0;
      let sampled = 0;
      for (let r = headerRowIdx + 1; r < Math.min(rawAoA.length, headerRowIdx + 15); r++) {
        const val = rawAoA[r]?.[c];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          sampled++;
          if (isDateLike(val)) dateMatchCount++;
        }
      }
      if (sampled > 0 && dateMatchCount / sampled >= 0.5) {
        headerMap.timestamp = c;
        break;
      }
    }
  }

  const result = [];
  let currentSC = '',
    currentPO = '',
    currentPODate = '';
  for (let i = headerRowIdx + 1; i < rawAoA.length; i++) {
    const row = rawAoA[i] || [];
    const getVal = (idx) => {
      if (idx === undefined) return '';
      const v = row[idx];
      if (v === null || v === undefined) return '';
      if (v instanceof Date) return v;
      return String(v).trim();
    };

    const scRaw = getVal(headerMap.sc);
    if (scRaw) currentSC = scRaw.replace(/\s+/g, '');

    const poRaw = getVal(headerMap.po);
    if (poRaw) currentPO = poRaw;

    const poDateRaw = getVal(headerMap.poDate);
    const parsedPODate = toIsoDateString(poDateRaw);
    if (parsedPODate) currentPODate = parsedPODate;

    const product = getVal(headerMap.product);
    const status1 = getVal(headerMap.status1);
    const status2 = getVal(headerMap.status2);
    const inhouse = normalizeInhouse(getVal(headerMap.inhouse));
    const opStage = getVal(headerMap.op);
    const timestamp = normalizeTimestamp(getVal(headerMap.timestamp));
    const familyRaw = getVal(headerMap.family);
    const templateRaw = getVal(headerMap.template);
    const projectedDate = toIsoDateString(getVal(headerMap.projectedDate));
    const estimatedDelivery = toIsoDateString(getVal(headerMap.estimatedDelivery));

    if (!product && !status1 && !status2 && !opStage) continue;
    if (!currentSC && !currentPO) continue;

    const type = familyRaw ? String(familyRaw).trim().toUpperCase() : inferType(product);

    result.push({
      sc: currentSC,
      po: currentPO,
      poDate: currentPODate,
      family: familyRaw ? String(familyRaw).trim().toUpperCase() : type,
      template: templateRaw ? String(templateRaw).trim() : '',
      projectedDate,
      estimatedDelivery,
      product,
      type,
      status1,
      status2,
      inhouse,
      currentStage: resolveLatestStage({ opStage, status1, status2 }),
      timestamp,
    });
  }
  return result.filter((r) => r.sc || r.po);
}

async function parseWorksheet(ws) {
  const XLSX = await import('xlsx');
  const rawAoA = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
  const headerMapped = parseRowsFromHeaderAoA(rawAoA);
  if (headerMapped.length > 0) return headerMapped;
  const isVelanFormat =
    rawAoA
      .slice(0, 5)
      .some((row) => row && row.some((cell) => cell && String(cell).includes('VELAN METROLOGY'))) ||
    rawAoA
      .slice(0, 6)
      .some((row) => row && row.some((cell) => String(cell || '').trim() === 'SNO'));
  if (isVelanFormat) return parseVelanExcel(rawAoA);
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  return parseGenericRows(rows);
}

export { parseRawCsv, parseVelanExcel, parseGenericRows, parseRowsFromHeaderAoA, parseWorksheet };
