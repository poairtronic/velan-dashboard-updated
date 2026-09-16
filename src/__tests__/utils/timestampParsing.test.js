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
});
