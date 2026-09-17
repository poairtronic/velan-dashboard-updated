import { describe, it, expect } from 'vitest';
import { normalizeTimestamp } from '../../services/dataNormalizer';
import { toIsoDateString } from '../../utils/dateUtils';
import { parseRowsFromHeaderAoA } from '../../services/excelParser';
import { parseDateTime } from '../../utils/calculationUtils.js';

describe('normalizeTimestamp & Date Normalization', () => {
  it('should format native Date objects correctly to YYYY-MM-DD HH:MM:SS', () => {
    const d = new Date(2026, 8, 16, 14, 30, 45); // Sept 16, 2026 14:30:45
    const res = normalizeTimestamp(d);
    expect(res).toBe('2026-09-16 14:30:45');
  });

  it('should parse Excel numeric serial timestamps', () => {
    // 46148 = 2026-05-06
    const serialWithTime = 46148.5; // 12:00:00 UTC
    const res = normalizeTimestamp(serialWithTime);
    expect(res).toBe('2026-05-06 12:00:00');
  });

  it('should handle 12-hour AM/PM formats correctly', () => {
    expect(normalizeTimestamp('16/09/2026 02:30:00 PM')).toBe('2026-09-16 14:30:00');
    expect(normalizeTimestamp('16/09/2026 12:30:00 PM')).toBe('2026-09-16 12:30:00');
    expect(normalizeTimestamp('16/09/2026 12:15:00 AM')).toBe('2026-09-16 00:15:00');
    expect(normalizeTimestamp('16/09/2026 9:45 AM')).toBe('2026-09-16 09:45:00');
  });

  it('should handle named month formats', () => {
    expect(normalizeTimestamp('16-Sep-2026 10:20:30')).toBe('2026-09-16 10:20:30');
    expect(normalizeTimestamp('16-September-2026 15:00:00')).toBe('2026-09-16 15:00:00');
  });

  it('should normalize date-only strings by appending 00:00:00', () => {
    expect(normalizeTimestamp('16/09/2026')).toBe('2026-09-16 00:00:00');
    expect(normalizeTimestamp('2026-09-16')).toBe('2026-09-16 00:00:00');
  });

  it('should handle invalid/blank values gracefully', () => {
    expect(normalizeTimestamp('')).toBe('');
    expect(normalizeTimestamp(null)).toBe('');
    expect(normalizeTimestamp(undefined)).toBe('');
    expect(normalizeTimestamp('—')).toBe('');
  });
});

describe('toIsoDateString with named months', () => {
  it('should parse DD-Mon-YYYY and Mon DD, YYYY formats', () => {
    expect(toIsoDateString('16-Sep-2026')).toBe('2026-09-16');
    expect(toIsoDateString('16 Sep 2026')).toBe('2026-09-16');
    expect(toIsoDateString('Sep 16, 2026')).toBe('2026-09-16');
    expect(toIsoDateString('05-Jan-2026')).toBe('2026-01-05');
  });
});

describe('parseDateTime in calculationUtils', () => {
  it('should preserve hours and minutes on ISO strings containing T', () => {
    const dt = parseDateTime('2026-09-16T14:30:00');
    expect(dt).not.toBeNull();
    expect(dt.getHours()).toBe(14);
    expect(dt.getMinutes()).toBe(30);
  });

  it('should preserve PM hours correctly', () => {
    const dt = parseDateTime('2026-09-16 03:45:00 PM');
    expect(dt).not.toBeNull();
    expect(dt.getHours()).toBe(15);
    expect(dt.getMinutes()).toBe(45);
  });
});

describe('parseRowsFromHeaderAoA Google Sheets extraction', () => {
  it('should identify OP UPDATED DATE column from Google Sheets', () => {
    const rawAoA = [
      ['SNO', 'PO NO', 'PO DATE', 'PO RECD DATE', 'SC NO', 'PRODUCT NAME', 'FAMILY', 'STATUS 1', 'STATUS 2', 'INHOUSE/VENDOR', 'OP', 'OP UPDATED DATE'],
      ['1', 'PO-9001', '10/06/2026', '10/06/2026', '1550-1', 'SPG DIA 47.587/47.60', 'SPG', '', 'MOVE TO VA', 'INHOUSE', 'VA', '16/09/2026 12:30:00'],
      ['2', 'PO-9001', '10/06/2026', '10/06/2026', '1550-2', 'ARG DIA 47.587/47.60', 'ARG', '', 'MOVE TO VA', 'INHOUSE', 'VA', '16/09/2026 14:00:00'],
    ];

    const rows = parseRowsFromHeaderAoA(rawAoA);
    expect(rows.length).toBe(2);
    expect(rows[0].sc).toBe('1550-1');
    expect(rows[0].po).toBe('PO-9001');
    expect(rows[0].currentStage).toBe('VA');
    expect(rows[0].timestamp).toBe('2026-09-16 12:30:00');
    expect(rows[1].timestamp).toBe('2026-09-16 14:00:00');
  });

  it('should use structural fallback to find date column if header cell is empty', () => {
    const rawAoA = [
      ['SNO', 'PO', 'PO DATE', 'PO RECD DATE', 'SC NO', 'PRODUCT NAME', 'FAMILY', 'STATUS 1', 'STATUS 2', 'INHOUSE/VENDOR', 'OP', ''], // Empty header at col 11
      ['1', 'PO-9002', '10/06/2026', '10/06/2026', '1600-1', 'SPG DIA 19.975/20.00', 'SPG', '', 'MOVE TO FB', 'INHOUSE', 'FB', '16/09/2026 11:15:00'],
    ];

    const rows = parseRowsFromHeaderAoA(rawAoA);
    expect(rows.length).toBe(1);
    expect(rows[0].sc).toBe('1600-1');
    expect(rows[0].timestamp).toBe('2026-09-16 11:15:00');
  });

  it('should parse CSV with title row and map Column L to timestamp correctly', async () => {
    const { parseCSV } = await import('../../server/utils/helpers.js');
    const csv = [
      ',,,,,,,,,,,',
      ',,,,,PRODUCTION STATUS,,,,,,',
      ',,,,,,,,,,,',
      'SNO,PO NO,PO RECD DATE,SC NO,,PRODUCT NAME,QTY,STATUS 1,STATUS 2,INHOUSE/ VENDOR,OP,OP UPDATED DATE',
      '1,AGIPLPO427,10/06/2026,1550-1,,ARG DIA 47.587,1 NO,,MOVE TO VA,INHOUSE,VA,12/09/2026 19:30:29',
      '2,,,1550-1,,SPG DIA 47.587,1 SET,,MOVE TO VA,INHOUSE,VA,25/08/2026 18:06:53',
    ].join('\n');

    const rows = parseCSV(csv);
    expect(rows.length).toBe(2);
    expect(rows[0].po).toBe('AGIPLPO427');
    expect(rows[0].poDate).toBe('10/06/2026');
    expect(rows[0].currentStage).toBe('VA');
    expect(rows[0].timestamp).toBe('2026-09-12 19:30:29');
    // Second row under same PO must inherit PO and have its own stage timestamp
    expect(rows[1].po).toBe('AGIPLPO427');
    expect(rows[1].timestamp).toBe('2026-08-25 18:06:53');
  });

  it('should NOT forward-fill SC onto subsequent rows or POs when SC is blank', async () => {
    const { parseVelanExcel, parseRowsFromHeaderAoA } = await import('../../services/excelParser.js');
    const { parseCSV } = await import('../../server/utils/helpers.js');

    // Test parseVelanExcel:
    const velanAoA = [
      ['SNO', 'PO NO', 'PO DATE', '', 'SC NO', 'Product Name', 'QTY', 'STATUS 1', 'STATUS 2', 'INHOUSE', 'STAGE', 'TIMESTAMP'],
      ['183', 'AGIPLPO1080-RKS ENGG', '12/09/2026', '', '2234', 'APG DIA 30 H8+0.033', '1 NO', 'MOVE TO LATHE', '', 'INHOUSE', 'LATHE-FB', '17/09/2026 11:49:12'],
      ['', '', '', '', '2234', 'DEPTH COLLAR', '1 NO', '', '', 'INHOUSE', 'FBI-V1', '17/09/2026 14:17:34'],
      ['184', 'AGIPLPO1111-ASF', '15/09/2026', '', '', 'ARG DIA 30.012+/-0.010', '1 NO', '', '', 'INHOUSE', '', ''],
      ['', '', '', '', '', 'SPG DIA 30.012+/-0.010', '1 SET', '', '', 'INHOUSE', '', ''],
      ['185', 'AGIPLPO1110 - ROOTS', '15/09/2026', '', '', 'APG DIA 9.525/9.532', '1 NO', '', '', 'INHOUSE', '', ''],
    ];

    const vRows = parseVelanExcel(velanAoA);
    expect(vRows.length).toBe(5);
    expect(vRows[0].po).toBe('AGIPLPO1080-RKS ENGG');
    expect(vRows[0].sc).toBe('2234');
    expect(vRows[1].po).toBe('AGIPLPO1080-RKS ENGG');
    expect(vRows[1].sc).toBe('2234');

    // Row 184 and onwards must have blank SC!
    expect(vRows[2].po).toBe('AGIPLPO1111-ASF');
    expect(vRows[2].sc).toBe('');
    expect(vRows[3].po).toBe('AGIPLPO1111-ASF');
    expect(vRows[3].sc).toBe('');
    expect(vRows[4].po).toBe('AGIPLPO1110 - ROOTS');
    expect(vRows[4].sc).toBe('');

    // Test parseRowsFromHeaderAoA:
    const headerAoA = [
      ['SNO', 'PO NO', 'PO DATE', 'SC NO', 'PRODUCT NAME', 'QTY', 'STATUS 1', 'STATUS 2', 'INHOUSE', 'STAGE', 'TIMESTAMP'],
      ['1', 'AGIPLPO1080-RKS ENGG', '12/09/2026', '2234', 'APG DIA 30 H8+0.033', '1 NO', 'MOVE TO LATHE', '', 'INHOUSE', 'LATHE-FB', '17/09/2026 11:49:12'],
      ['2', '', '', '2234', 'DEPTH COLLAR', '1 NO', '', '', 'INHOUSE', 'FBI-V1', '17/09/2026 14:17:34'],
      ['3', 'AGIPLPO1111-ASF', '15/09/2026', '', 'ARG DIA 30.012+/-0.010', '1 NO', '', '', 'INHOUSE', '', ''],
      ['4', 'AGIPLPO1110 - ROOTS', '15/09/2026', '', 'APG DIA 9.525/9.532', '1 NO', '', '', 'INHOUSE', '', ''],
    ];
    const hRows = parseRowsFromHeaderAoA(headerAoA);
    expect(hRows.length).toBe(4);
    expect(hRows[0].sc).toBe('2234');
    expect(hRows[1].sc).toBe('2234');
    expect(hRows[2].po).toBe('AGIPLPO1111-ASF');
    expect(hRows[2].sc).toBe('');
    expect(hRows[3].po).toBe('AGIPLPO1110 - ROOTS');
    expect(hRows[3].sc).toBe('');

    // Test parseCSV:
    const csv = [
      'SNO,PO NO,PO DATE,SC NO,PRODUCT NAME,STATUS 1,STATUS 2,INHOUSE,OP,TIMESTAMP',
      '1,AGIPLPO1080-RKS ENGG,12/09/2026,2234,APG DIA 30 H8+0.033,MOVE TO LATHE,,INHOUSE,LATHE-FB,17/09/2026 11:49:12',
      '2,,,2234,DEPTH COLLAR,,,INHOUSE,FBI-V1,17/09/2026 14:17:34',
      '3,AGIPLPO1111-ASF,15/09/2026,,ARG DIA 30.012+/-0.010,,,INHOUSE,,',
      '4,AGIPLPO1110 - ROOTS,15/09/2026,,APG DIA 9.525/9.532,,,INHOUSE,,',
    ].join('\n');
    const cRows = parseCSV(csv);
    expect(cRows.length).toBe(4);
    expect(cRows[0].sc).toBe('2234');
    expect(cRows[1].sc).toBe('2234');
    expect(cRows[2].po).toBe('AGIPLPO1111-ASF');
    expect(cRows[2].sc).toBe('');
    expect(cRows[3].po).toBe('AGIPLPO1110 - ROOTS');
    expect(cRows[3].sc).toBe('');
  });
});
