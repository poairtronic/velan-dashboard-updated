import { describe, it, expect } from 'vitest';
import calculationUtils from '../../utils/calculationUtils.js';
import { toIsoDateString } from '../../utils/dateUtils';
const { workingDaysBetween, 
  getProductCategory, 
  parseDateTime,
  isSLAViolation,
  calculateProcessEfficiency,
  calculateEstimatedDelivery,
  formatEstimatedDelivery,
  calculateSCProductionDate,
  calculateProductProjectedDate,
  canonicalProcess,
  toIsoDate,
  getTodayIso,
  getProductionDateStatus,
  addCalendarDays,
  isDateInNextDays,
  getVendorInfo,
  getVendorCode,
  getVendorName,
  VENDOR_MAP
 } = calculationUtils;

describe('calculationUtils', () => {
  describe('workingDaysBetween', () => {
    it('returns null for missing dates', () => {
      expect(workingDaysBetween(null, '2026-01-01')).toBeNull();
      expect(workingDaysBetween('2026-01-01', undefined)).toBeNull();
    });

    it('calculates correct working days excluding Sundays', () => {
      // 2026-01-04 is a Sunday. 2026-01-03 is Sat, 2026-01-05 is Mon.
      // Total inclusive working days = Sat + Mon = 2
      expect(workingDaysBetween('2026-01-03', '2026-01-05')).toBe(2); 
    });

    it('calculates negative days if d1 > d2', () => {
      expect(workingDaysBetween('2026-01-05', '2026-01-03')).toBeLessThan(0);
    });
  });

  describe('getProductCategory', () => {
    it('returns AIRPLUG for APG and ARG', () => {
      expect(getProductCategory('APG')).toBe('AIRPLUG');
      expect(getProductCategory('ARG')).toBe('AIRPLUG');
    });

    it('returns MASTER for SPG, SRG, SP', () => {
      expect(getProductCategory('SPG')).toBe('MASTER');
      expect(getProductCategory('SP')).toBe('MASTER');
    });

    it('returns ACCESSORY for unknown types', () => {
      expect(getProductCategory('UNKNOWN')).toBe('ACCESSORY');
    });
  });

  describe('parseDateTime', () => {
    it('parses YYYY-MM-DD HH:MM:SS format', () => {
      const dt = parseDateTime('2026-02-15 14:30:00');
      expect(dt.getFullYear()).toBe(2026);
      expect(dt.getMonth()).toBe(1); // 0-indexed
      expect(dt.getDate()).toBe(15);
      expect(dt.getHours()).toBe(14);
      expect(dt.getMinutes()).toBe(30);
    });
  });

  describe('isSLAViolation', () => {
    it('returns true if agingDays > threshold', () => {
      expect(isSLAViolation(3, 2)).toBe(true);
      expect(isSLAViolation(5, 4)).toBe(true);
    });

    it('returns false if agingDays <= threshold', () => {
      expect(isSLAViolation(2, 2)).toBe(false);
      expect(isSLAViolation(1, 2)).toBe(false);
    });
  });

  describe('calculateProcessEfficiency', () => {
    it('calculates percentage correctly', () => {
      expect(calculateProcessEfficiency(50, 100)).toBe(50);
      expect(calculateProcessEfficiency(30, 90)).toBe(33);
    });

    it('returns 0 if totalTime is 0 or null', () => {
      expect(calculateProcessEfficiency(50, 0)).toBe(0);
      expect(calculateProcessEfficiency(50, null)).toBe(0);
    });
  });

  describe('calculateEstimatedDelivery', () => {
    it('calculates 6-week (+42 calendar days) for APG/SRG/ACCESSORIES and 8-week (+56 calendar days) for ARG/SPG/ACG/Carbide', () => {
      const apgRes = calculateEstimatedDelivery('2026-09-01', 'APG');
      expect(apgRes).not.toBeNull();
      expect(apgRes.startDate).toBe('2026-10-13');
      expect(apgRes.endDate).toBe('2026-10-13');
      expect(apgRes.formatted).toBe('13/10/2026');
      expect(apgRes.weeks).toBe(6);

      const argRes = calculateEstimatedDelivery('2026-09-01', 'ARG');
      expect(argRes).not.toBeNull();
      expect(argRes.startDate).toBe('2026-10-27');
      expect(argRes.endDate).toBe('2026-10-27');
      expect(argRes.formatted).toBe('27/10/2026');
      expect(argRes.weeks).toBe(8);
    });

    it('handles APG (6 weeks): 01/09/2026 -> 13/10/2026', () => {
      const resIso = calculateEstimatedDelivery('2026-09-01', 'APG');
      expect(resIso.startDate).toBe('2026-10-13');
      expect(resIso.endDate).toBe('2026-10-13');
      expect(resIso.formatted).toBe('13/10/2026');

      const resSlash = calculateEstimatedDelivery('01/09/2026', 'APG');
      expect(resSlash.startDate).toBe('2026-10-13');
      expect(resSlash.endDate).toBe('2026-10-13');
      expect(resSlash.formatted).toBe('13/10/2026');
    });

    it('handles ARG (8 weeks): 10/09/2026 -> 05/11/2026', () => {
      const resIso = calculateEstimatedDelivery('2026-09-10', 'ARG');
      expect(resIso.startDate).toBe('2026-11-05');
      expect(resIso.endDate).toBe('2026-11-05');
      expect(resIso.formatted).toBe('05/11/2026');

      const resSlash = calculateEstimatedDelivery('10/09/2026', 'ARG');
      expect(resSlash.startDate).toBe('2026-11-05');
      expect(resSlash.endDate).toBe('2026-11-05');
      expect(resSlash.formatted).toBe('05/11/2026');
    });

    it('calculates exact 42-day difference for APG and 56-day difference for ARG', () => {
      const poDate = '2026-05-01';
      const apgRes = calculateEstimatedDelivery(poDate, 'APG');
      const argRes = calculateEstimatedDelivery(poDate, 'ARG');
      const apgDiff = (new Date(apgRes.startDate) - new Date(poDate)) / (1000 * 60 * 60 * 24);
      const argDiff = (new Date(argRes.startDate) - new Date(poDate)) / (1000 * 60 * 60 * 24);
      expect(apgDiff).toBe(42);
      expect(argDiff).toBe(56);
    });

    it('handles month rollover correctly', () => {
      const apgRes = calculateEstimatedDelivery('2026-01-31', 'APG');
      expect(apgRes.startDate).toBe('2026-03-14');
      const argRes = calculateEstimatedDelivery('2026-01-31', 'ARG');
      expect(argRes.startDate).toBe('2026-03-28');
    });

    it('handles year rollover correctly', () => {
      const apgRes = calculateEstimatedDelivery('2026-12-15', 'APG');
      expect(apgRes.startDate).toBe('2027-01-26');
      const argRes = calculateEstimatedDelivery('2026-12-15', 'ARG');
      expect(argRes.startDate).toBe('2027-02-09');
    });

    it('handles leap-year vs non-leap-year arithmetic correctly', () => {
      // 2024 is a leap year (Feb has 29 days)
      const resLeap = calculateEstimatedDelivery('2024-02-01', 'APG');
      expect(resLeap.startDate).toBe('2024-03-14');

      // 2026 is a standard year (Feb has 28 days)
      const resStd = calculateEstimatedDelivery('2026-02-01', 'APG');
      expect(resStd.startDate).toBe('2026-03-15');
    });

    it('returns null for missing, empty, or placeholder PO dates', () => {
      expect(calculateEstimatedDelivery(null)).toBeNull();
      expect(calculateEstimatedDelivery(undefined)).toBeNull();
      expect(calculateEstimatedDelivery('')).toBeNull();
      expect(calculateEstimatedDelivery('—')).toBeNull();
      expect(calculateEstimatedDelivery('-')).toBeNull();
      expect(calculateEstimatedDelivery('null')).toBeNull();
    });

    it('returns null for invalid or malformed PO date strings', () => {
      expect(calculateEstimatedDelivery('invalid-date')).toBeNull();
      expect(calculateEstimatedDelivery('abc')).toBeNull();
      expect(calculateEstimatedDelivery('2026-13-45')).toBeNull();
    });

    it('does NOT skip weekends (uses calendar days, not working days)', () => {
      // Starting from a Saturday:
      const res = calculateEstimatedDelivery('2026-01-03', 'APG');
      // 42 calendar days later
      expect(res.startDate).toBe('2026-02-14');
    });

    it('is completely independent of Projected Date', () => {
      const poDate = '2026-09-01';
      const item1 = { poDate, projectedDate: '2026-09-15' };
      const item2 = { poDate, projectedDate: '2026-11-30' };

      const est1 = calculateEstimatedDelivery(item1.poDate, 'APG');
      const est2 = calculateEstimatedDelivery(item2.poDate, 'APG');

      expect(est1).toEqual(est2);
      expect(est1.startDate).toBe('2026-10-13');
    });

    it('supports custom start/end week parameters if needed', () => {
      const res = calculateEstimatedDelivery('2026-01-01', 4, 10);
      expect(res.startDate).toBe('2026-01-29'); // +28 days
      expect(res.endDate).toBe('2026-03-12');   // +70 days
      expect(res.formatted).toBe('29/01/2026 – 12/03/2026');
    });
  });

  describe('formatEstimatedDelivery', () => {
    it('formats valid estimated delivery objects cleanly', () => {
      const est = {
        startDate: '2026-10-13',
        endDate: '2026-10-27',
        formatted: '13/10/2026 – 27/10/2026'
      };
      expect(formatEstimatedDelivery(est)).toBe('13/10/2026 – 27/10/2026');
    });

    it('formats objects without formatted field using startDate and endDate', () => {
      const est = {
        startDate: '2026-10-13',
        endDate: '2026-10-27',
      };
      expect(formatEstimatedDelivery(est)).toBe('13/10/2026 – 27/10/2026');
    });

    it('returns — for null or undefined input', () => {
      expect(formatEstimatedDelivery(null)).toBe('—');
      expect(formatEstimatedDelivery(undefined)).toBe('—');
      expect(formatEstimatedDelivery('')).toBe('—');
    });

    it('returns raw string if already formatted', () => {
      expect(formatEstimatedDelivery('13/10/2026 – 27/10/2026')).toBe('13/10/2026 – 27/10/2026');
    });
  });

  describe('calculateSCProductionDate', () => {
    it('Test 1 — returns null for empty array', () => {
      expect(calculateSCProductionDate([])).toBeNull();
      expect(calculateSCProductionDate(null)).toBeNull();
      expect(calculateSCProductionDate(undefined)).toBeNull();
    });

    it('Test 2 — returns null when all child products have missing/null projected dates', () => {
      const items = [
        { product: 'Product A', projectedDate: null },
        { product: 'Product B', projectedDate: null },
        { product: 'Product C', projectedDate: '' },
        { product: 'Product D', projectedDate: '—' },
      ];
      expect(calculateSCProductionDate(items)).toBeNull();
    });

    it('Test 3 — returns the exact date when only one product has a valid date', () => {
      const items = [
        { product: 'Product A', projectedDate: '2026-09-15' },
      ];
      expect(calculateSCProductionDate(items)).toBe('2026-09-15');
    });

    it('Test 4 — returns the MAX date for multiple products in SC 1571 example (15, 14, 20 -> 20)', () => {
      const items = [
        { product: 'Product A', projectedDate: '2026-09-15' },
        { product: 'Product B', projectedDate: '2026-09-14' },
        { product: 'Product C', projectedDate: '2026-09-20' },
      ];
      expect(calculateSCProductionDate(items)).toBe('2026-09-20');
    });

    it('Test 5 — handles mixed missing values safely (15, null, 20 -> 20)', () => {
      const items = [
        { product: 'Product A', projectedDate: '2026-09-15' },
        { product: 'Product B', projectedDate: null },
        { product: 'Product C', projectedDate: '2026-09-20' },
      ];
      expect(calculateSCProductionDate(items)).toBe('2026-09-20');
    });

    it('Test 6 — handles invalid date strings safely without breaking (invalid, 15, 20 -> 20)', () => {
      const items = [
        { product: 'Product A', projectedDate: 'invalid' },
        { product: 'Product B', projectedDate: '2026-09-15' },
        { product: 'Product C', projectedDate: '2026-09-20' },
      ];
      expect(calculateSCProductionDate(items)).toBe('2026-09-20');
    });

    it('Test 7 — verifies multiple SC groups remain completely isolated', () => {
      const sc1571 = [
        { product: 'Product A', projectedDate: '2026-09-15' },
        { product: 'Product B', projectedDate: '2026-09-20' },
      ];
      const sc1572 = [
        { product: 'Product C', projectedDate: '2026-09-10' },
        { product: 'Product D', projectedDate: '2026-09-12' },
      ];

      expect(calculateSCProductionDate(sc1571)).toBe('2026-09-20');
      expect(calculateSCProductionDate(sc1572)).toBe('2026-09-12');
    });

    it('Test 8 — handles dynamic changes across product dates (15,14,20->20 -> 15,30,20->30 -> 15,10,20->20)', () => {
      const items = [
        { product: 'Product A', projectedDate: '2026-09-15' },
        { product: 'Product B', projectedDate: '2026-09-14' },
        { product: 'Product C', projectedDate: '2026-09-20' },
      ];
      expect(calculateSCProductionDate(items)).toBe('2026-09-20');

      // Change Product B to 2026-09-30
      items[1].projectedDate = '2026-09-30';
      expect(calculateSCProductionDate(items)).toBe('2026-09-30');

      // Change Product B to 2026-09-10
      items[1].projectedDate = '2026-09-10';
      expect(calculateSCProductionDate(items)).toBe('2026-09-20');
    });

    it('Test 9 — Projected Date and SC Production Date are independent of Estimated Delivery', () => {
      const items = [
        { product: 'Product A', projectedDate: '2026-09-15', poDate: '2026-08-01' },
        { product: 'Product B', projectedDate: '2026-09-20', poDate: '2026-08-01' },
      ];
      const scProdDateBefore = calculateSCProductionDate(items);
      expect(scProdDateBefore).toBe('2026-09-20');

      // Changing PO Date changes Estimated Delivery, but SC Production Date remains identical
      items.forEach(i => i.poDate = '2026-09-01');
      const scProdDateAfter = calculateSCProductionDate(items);
      expect(scProdDateAfter).toBe('2026-09-20');
    });

    it('Test 10 — Changing Projected Dates does not modify Estimated Delivery', () => {
      const poDate = '2026-09-01';
      const est1 = calculateEstimatedDelivery(poDate, 'APG');
      expect(est1.startDate).toBe('2026-10-13');
      expect(est1.endDate).toBe('2026-10-13');

      // Projected Dates changed from Sep to Nov
      const items = [
        { product: 'Product A', projectedDate: '2026-11-15' },
        { product: 'Product B', projectedDate: '2026-11-30' },
      ];
      expect(calculateSCProductionDate(items)).toBe('2026-11-30');

      // Estimated Delivery from PO date is still strictly Oct 13
      const est2 = calculateEstimatedDelivery(poDate, 'APG');
      expect(est2).toEqual(est1);
    });

    it('Test 11 — handles Indian DD/MM/YYYY slash dates in child products', () => {
      const items = [
        { product: 'Product A', projectedDate: '15/09/2026' },
        { product: 'Product B', projectedDate: '14/09/2026' },
        { product: 'Product C', projectedDate: '20/09/2026' },
      ];
      expect(calculateSCProductionDate(items)).toBe('2026-09-20');
    });
  });

  describe('Phase 5 — Date Integration & Filter Independence', () => {
    it('verifies that SC Production Date derives from complete SC child dataset regardless of UI filtering', () => {
      // Full SC dataset with 3 items
      const fullSCItems = [
        { sc: '1571', product: 'Product A (Plug)', type: 'APG', projectedDate: '2026-09-15' },
        { sc: '1571', product: 'Product B (Ring)', type: 'ARG', projectedDate: '2026-09-14' },
        { sc: '1571', product: 'Product C (Master)', type: 'SPG', projectedDate: '2026-09-20' },
      ];

      // Entire SC Production Date
      const fullSCProductionDate = calculateSCProductionDate(fullSCItems);
      expect(fullSCProductionDate).toBe('2026-09-20');

      // If user filters UI by type: 'APG' (only Product A visible on screen),
      // the business SC Production Date for SC 1571 MUST remain 2026-09-20 (from the complete dataset)
      const uiFilteredItems = fullSCItems.filter(item => item.type === 'APG');
      expect(uiFilteredItems.length).toBe(1);

      // Business rule check: The SC production date attached to the SC group entity retains the MAX of all items
      const scGroupEntity = {
        sc: '1571',
        items: fullSCItems,
        scProductionDate: calculateSCProductionDate(fullSCItems),
      };
      expect(scGroupEntity.scProductionDate).toBe('2026-09-20');
    });

    it('sorts date columns chronologically and places null/missing dates last in ascending order', () => {
      const rows = [
        { sc: '1', scProductionDate: '2026-10-05' },
        { sc: '2', scProductionDate: null },
        { sc: '3', scProductionDate: '2026-09-15' },
        { sc: '4', scProductionDate: '2026-09-28' },
        { sc: '5', scProductionDate: undefined },
      ];

      const sortedAsc = [...rows].sort((a, b) => {
        const da = a.scProductionDate ? new Date(a.scProductionDate).getTime() : null;
        const db = b.scProductionDate ? new Date(b.scProductionDate).getTime() : null;
        if (da === null && db === null) return 0;
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      });

      expect(sortedAsc.map(r => r.sc)).toEqual(['3', '4', '1', '2', '5']);
      expect(sortedAsc[0].scProductionDate).toBe('2026-09-15');
      expect(sortedAsc[1].scProductionDate).toBe('2026-09-28');
      expect(sortedAsc[2].scProductionDate).toBe('2026-10-05');
      expect(sortedAsc[3].scProductionDate).toBeNull();
      expect(sortedAsc[4].scProductionDate).toBeUndefined();
    });

    it('correctly handles Estimated Delivery sorting by startDate with nulls last', () => {
      const rows = [
        { po: 'PO-1', est: calculateEstimatedDelivery('2026-09-10') }, // start: 2026-10-22
        { po: 'PO-2', est: calculateEstimatedDelivery(null) },         // null
        { po: 'PO-3', est: calculateEstimatedDelivery('2026-08-01') }, // start: 2026-09-12
      ];

      const sortedAsc = [...rows].sort((a, b) => {
        const da = a.est?.startDate ? new Date(a.est.startDate).getTime() : null;
        const db = b.est?.startDate ? new Date(b.est.startDate).getTime() : null;
        if (da === null && db === null) return 0;
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      });

      expect(sortedAsc[0].po).toBe('PO-3');
      expect(sortedAsc[1].po).toBe('PO-1');
      expect(sortedAsc[2].po).toBe('PO-2');
    });

    it('verifies the three-tier date hierarchy remains distinct and non-interfering', () => {
      const poDate = '2026-09-01';
      const items = [
        { sc: '1571', product: 'Gauge A', poDate, projectedDate: '2026-09-15' },
        { sc: '1571', product: 'Gauge B', poDate, projectedDate: '2026-09-22' },
      ];

      // Tier 1: Product Projected Date
      expect(items[0].projectedDate).toBe('2026-09-15');
      expect(items[1].projectedDate).toBe('2026-09-22');

      // Tier 2: SC Production Date (MAX of Tier 1)
      const scProdDate = calculateSCProductionDate(items);
      expect(scProdDate).toBe('2026-09-22');

      // Tier 3: Estimated Delivery (from PO Date, family APG = 6 weeks)
      const estDelivery = calculateEstimatedDelivery(poDate, 'APG');
      expect(estDelivery.startDate).toBe('2026-10-13');
      expect(estDelivery.endDate).toBe('2026-10-13');
      expect(formatEstimatedDelivery(estDelivery)).toBe('13/10/2026');

      // Assert semantic separation: scProdDate is September, Estimated Delivery is October
      expect(new Date(scProdDate).getTime()).toBeLessThan(new Date(estDelivery.startDate).getTime());
    });
  });

  describe('Phase 6 — Date Data Quality, Validation & Hardening', () => {
    describe('Step 4 & 5 — Projected Date Validation & Timezone Safety', () => {
      it('converts valid date strings to canonical ISO YYYY-MM-DD format', () => {
        expect(toIsoDateString('2026-09-20')).toBe('2026-09-20');
        expect(toIsoDateString('20/09/2026')).toBe('2026-09-20');
        expect(toIsoDateString('20-09-2026')).toBe('2026-09-20');
        expect(toIsoDateString('20 09 2026')).toBe('2026-09-20');
        expect(toIsoDateString('2026/09/20')).toBe('2026-09-20');
        expect(toIsoDateString('20/09/26')).toBe('2026-09-20');
      });

      it('safely rejects empty, whitespace, and placeholder strings without producing fake dates', () => {
        expect(toIsoDateString(null)).toBe('');
        expect(toIsoDateString(undefined)).toBe('');
        expect(toIsoDateString('')).toBe('');
        expect(toIsoDateString('   ')).toBe('');
        expect(toIsoDateString('—')).toBe('');
        expect(toIsoDateString('-')).toBe('');
        expect(toIsoDateString('null')).toBe('');
        expect(toIsoDateString('undefined')).toBe('');
        expect(toIsoDateString('NaN')).toBe('');
        expect(toIsoDateString('N/A')).toBe('');
        expect(toIsoDateString('TBD')).toBe('');
        expect(toIsoDateString('ASAP')).toBe('');
        expect(toIsoDateString('INVALID')).toBe('');
        expect(toIsoDateString('invalid text')).toBe('');
      });

      it('safely rejects syntactically invalid calendar values', () => {
        expect(toIsoDateString('2026-13-45')).toBe('');
        expect(toIsoDateString('2026-00-00')).toBe('');
        expect(toIsoDateString('99/99/2026')).toBe('');
        expect(toIsoDateString('abc')).toBe('');
      });

      it('preserves calendar date without timezone shift (20/09/2026 never shifts to 19/09/2026)', () => {
        const input = '20/09/2026';
        const iso = toIsoDateString(input);
        expect(iso).toBe('2026-09-20');

        // Check date parts directly:
        const [y, m, d] = iso.split('-').map(Number);
        expect(y).toBe(2026);
        expect(m).toBe(9);
        expect(d).toBe(20);
      });
    });

    describe('Step 6, 7 & 8 — SC Production Date Validation & Missing/Invalid Tolerance', () => {
      it('Step 7 Case A: All dates valid (15, 14, 20 -> 20)', () => {
        const items = [
          { product: 'A', projectedDate: '15/09/2026' },
          { product: 'B', projectedDate: '14/09/2026' },
          { product: 'C', projectedDate: '20/09/2026' },
        ];
        expect(calculateSCProductionDate(items)).toBe('2026-09-20');
      });

      it('Step 7 Case B: Mixed missing date (15, null, 20 -> 20)', () => {
        const items = [
          { product: 'A', projectedDate: '15/09/2026' },
          { product: 'B', projectedDate: null },
          { product: 'C', projectedDate: '20/09/2026' },
        ];
        expect(calculateSCProductionDate(items)).toBe('2026-09-20');
      });

      it('Step 7 Case C: Multiple missing dates (null, null, 20 -> 20)', () => {
        const items = [
          { product: 'A', projectedDate: null },
          { product: 'B', projectedDate: '' },
          { product: 'C', projectedDate: '20/09/2026' },
        ];
        expect(calculateSCProductionDate(items)).toBe('2026-09-20');
      });

      it('Step 7 Case D: All missing dates (null, null, null -> null)', () => {
        const items = [
          { product: 'A', projectedDate: null },
          { product: 'B', projectedDate: '' },
          { product: 'C', projectedDate: '—' },
        ];
        expect(calculateSCProductionDate(items)).toBeNull();
      });

      it('Step 8: Invalid dates safely discarded (invalid, 15, 20 -> 20)', () => {
        const items = [
          { product: 'A', projectedDate: 'INVALID_TEXT' },
          { product: 'B', projectedDate: '15/09/2026' },
          { product: 'C', projectedDate: '20/09/2026' },
        ];
        expect(calculateSCProductionDate(items)).toBe('2026-09-20');
      });

      it('Step 8: All invalid dates safely result in null (invalid, invalid, invalid -> null)', () => {
        const items = [
          { product: 'A', projectedDate: 'INVALID_1' },
          { product: 'B', projectedDate: 'TBD' },
          { product: 'C', projectedDate: 'NaN' },
        ];
        expect(calculateSCProductionDate(items)).toBeNull();
      });
    });

    describe('Step 9, 10 & 11 — Duplicate Resolution & SC Boundary Isolation', () => {
      it('Step 10: Calculates SC Production Date using effective live-row deduplicated items', () => {
        // Raw rows containing historical and live duplicate for Product A
        const rawRows = [
          { sc: '1571', product: 'Product A', projectedDate: '2026-09-15', timestamp: '2026-09-01 10:00:00', _isLive: false },
          { sc: '1571', product: 'Product A', projectedDate: '2026-09-18', timestamp: '2026-09-02 11:00:00', _isLive: true },
          { sc: '1571', product: 'Product B', projectedDate: '2026-09-20', timestamp: '2026-09-01 10:00:00', _isLive: true },
        ];

        // Deduplication using established live-row precedence:
        const latestMap = {};
        rawRows.forEach((r) => {
          const key = r.product.trim();
          const ex = latestMap[key];
          if (!ex) {
            latestMap[key] = r;
            return;
          }
          if (r._isLive && !ex._isLive) {
            latestMap[key] = r;
            return;
          }
          if (!r._isLive && ex._isLive) return;
          if (r.timestamp && (!ex.timestamp || r.timestamp > ex.timestamp)) latestMap[key] = r;
        });
        const effectiveItems = Object.values(latestMap);

        expect(effectiveItems.length).toBe(2);
        const prodA = effectiveItems.find(i => i.product === 'Product A');
        expect(prodA.projectedDate).toBe('2026-09-18');

        // SC Production Date = MAX(18/09/2026, 20/09/2026) = 2026-09-20
        expect(calculateSCProductionDate(effectiveItems)).toBe('2026-09-20');
      });

      it('Step 11: SC boundaries are strictly isolated with no product date leakage', () => {
        const sc1571Items = [
          { sc: '1571', product: 'Product A', projectedDate: '2026-09-15' },
          { sc: '1571', product: 'Product B', projectedDate: '2026-09-20' },
        ];
        const sc1572Items = [
          { sc: '1572', product: 'Product C', projectedDate: '2026-09-30' },
          { sc: '1572', product: 'Product D', projectedDate: '2026-10-05' },
        ];

        expect(calculateSCProductionDate(sc1571Items)).toBe('2026-09-20');
        expect(calculateSCProductionDate(sc1572Items)).toBe('2026-10-05');
        // Verify SC 1571 is never polluted by 1572 dates:
        expect(calculateSCProductionDate(sc1571Items)).not.toBe('2026-10-05');
      });
    });

    describe('Step 25 — Mathematical Invariant Assertions', () => {
      it('Invariant 1: SC Production Date is always the exact mathematical maximum valid child date', () => {
        const items = [
          { product: '1', projectedDate: '2026-08-10' },
          { product: '2', projectedDate: '2026-08-25' },
          { product: '3', projectedDate: '2026-08-18' },
        ];
        expect(calculateSCProductionDate(items)).toBe('2026-08-25');
      });

      it('Invariant 2: When a child date moves earlier, SC Production Date stays same or moves earlier, never later', () => {
        const items = [
          { product: '1', projectedDate: '2026-09-15' },
          { product: '2', projectedDate: '2026-09-25' }, // maximum
          { product: '3', projectedDate: '2026-09-20' },
        ];
        const initialMax = calculateSCProductionDate(items);
        expect(initialMax).toBe('2026-09-25');

        // Product 2 moves earlier to 2026-09-18
        items[1].projectedDate = '2026-09-18';
        const newMax = calculateSCProductionDate(items);
        expect(newMax).toBe('2026-09-20'); // Now product 3 is max
        expect(new Date(newMax).getTime()).toBeLessThanOrEqual(new Date(initialMax).getTime());
      });

      it('Invariant 3: When a child date moves later and becomes the maximum, SC Production Date moves to that later date', () => {
        const items = [
          { product: '1', projectedDate: '2026-09-15' },
          { product: '2', projectedDate: '2026-09-20' },
        ];
        expect(calculateSCProductionDate(items)).toBe('2026-09-20');

        // Product 1 moves to 2026-09-28
        items[0].projectedDate = '2026-09-28';
        expect(calculateSCProductionDate(items)).toBe('2026-09-28');
      });

      it('Invariant 4: Changing Estimated Delivery (PO Date) does not affect SC Production Date', () => {
        const items = [
          { product: '1', projectedDate: '2026-09-15' },
          { product: '2', projectedDate: '2026-09-20' },
        ];
        const scDateBefore = calculateSCProductionDate(items);

        // PO Date changes by 30 days
        const est1 = calculateEstimatedDelivery('2026-08-01');
        const est2 = calculateEstimatedDelivery('2026-09-01');
        expect(est1.startDate).not.toBe(est2.startDate);

        const scDateAfter = calculateSCProductionDate(items);
        expect(scDateAfter).toBe(scDateBefore);
      });

      it('Invariant 5: Changing Projected Date does not affect Estimated Delivery', () => {
        const poDate = '2026-09-01';
        const estBefore = calculateEstimatedDelivery(poDate);

        const items = [
          { product: '1', projectedDate: '2026-09-15' },
          { product: '2', projectedDate: '2026-09-20' },
        ];
        expect(calculateSCProductionDate(items)).toBe('2026-09-20');

        // Product dates change dramatically
        items[0].projectedDate = '2026-12-01';
        items[1].projectedDate = '2026-12-15';
        expect(calculateSCProductionDate(items)).toBe('2026-12-15');

        const estAfter = calculateEstimatedDelivery(poDate);
        expect(estAfter).toEqual(estBefore);
      });
    });

    describe('Step 30 — Complete End-to-End Acceptance Test Sequence', () => {
      it('executes the full Phase 6 acceptance scenario sequence accurately', () => {
        // 1. Initial State:
        // Product A -> 15/09/2026, Product B -> 14/09/2026, Product C -> 20/09/2026
        const items = [
          { product: 'Product A', projectedDate: '15/09/2026' },
          { product: 'Product B', projectedDate: '14/09/2026' },
          { product: 'Product C', projectedDate: '20/09/2026' },
        ];
        expect(calculateSCProductionDate(items)).toBe('2026-09-20');

        // 2. Change Product C -> 25/09/2026
        items[2].projectedDate = '25/09/2026';
        expect(calculateSCProductionDate(items)).toBe('2026-09-25');

        // 3. Make Product C INVALID
        items[2].projectedDate = 'INVALID';
        // Now Product A (15/09/2026) is the latest valid date
        expect(calculateSCProductionDate(items)).toBe('2026-09-15');

        // 4. Make all dates invalid/missing:
        // Product A -> null, Product B -> invalid, Product C -> null
        items[0].projectedDate = null;
        items[1].projectedDate = 'invalid';
        items[2].projectedDate = null;
        expect(calculateSCProductionDate(items)).toBeNull();
      });
    });
  });

  describe('Phase 7 — Production Date Analytics & Operational Visibility', () => {
    describe('Step 4 & 5 — toIsoDate and getTodayIso helper tests', () => {
      it('converts valid dates and date objects to standard ISO YYYY-MM-DD', () => {
        expect(toIsoDate('2026-09-20')).toBe('2026-09-20');
        expect(toIsoDate('20/09/2026')).toBe('2026-09-20');
        expect(toIsoDate('15-09-2026')).toBe('2026-09-15');
        expect(toIsoDate(new Date(2026, 8, 20))).toBe('2026-09-20');
      });

      it('returns empty string for missing or invalid date inputs', () => {
        expect(toIsoDate(null)).toBe('');
        expect(toIsoDate(undefined)).toBe('');
        expect(toIsoDate('')).toBe('');
        expect(toIsoDate('—')).toBe('');
        expect(toIsoDate('INVALID')).toBe('');
        expect(toIsoDate('TBD')).toBe('');
      });

      it('produces a valid ISO string from getTodayIso', () => {
        const todayStr = getTodayIso();
        expect(todayStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    describe('Step 6 & 7 — getProductionDateStatus classification', () => {
      const currentDate = '2026-09-15';

      it('returns OVERDUE for dates strictly before current date', () => {
        const status = getProductionDateStatus('2026-09-14', currentDate);
        expect(status.code).toBe('OVERDUE');
        expect(status.label).toBe('OVERDUE');
        expect(status.color).toBe('#ff3d5a');
      });

      it('returns DUE_TODAY for dates matching current date exactly', () => {
        const status = getProductionDateStatus('2026-09-15', currentDate);
        expect(status.code).toBe('DUE_TODAY');
        expect(status.label).toBe('DUE TODAY');
        expect(status.color).toBe('#ffd60a');
      });

      it('returns UPCOMING for dates strictly after current date', () => {
        const status = getProductionDateStatus('2026-09-16', currentDate);
        expect(status.code).toBe('UPCOMING');
        expect(status.label).toBe('UPCOMING');
        expect(status.color).toBe('#00c9ff');
      });

      it('returns NO_DATE for missing, empty, or invalid dates', () => {
        expect(getProductionDateStatus(null, currentDate).code).toBe('NO_DATE');
        expect(getProductionDateStatus('', currentDate).code).toBe('NO_DATE');
        expect(getProductionDateStatus('—', currentDate).code).toBe('NO_DATE');
        expect(getProductionDateStatus('INVALID', currentDate).code).toBe('NO_DATE');
      });
    });

    describe('Step 28 — Date transitions over time (14/09 -> 15/09 -> 16/09)', () => {
      const productionDate = '15/09/2026';

      it('transitions status predictably as current date advances', () => {
        // When current date is 14/09/2026 -> UPCOMING
        const statusBefore = getProductionDateStatus(productionDate, '2026-09-14');
        expect(statusBefore.code).toBe('UPCOMING');
        expect(statusBefore.label).toBe('UPCOMING');

        // When current date is 15/09/2026 -> DUE TODAY
        const statusToday = getProductionDateStatus(productionDate, '2026-09-15');
        expect(statusToday.code).toBe('DUE_TODAY');
        expect(statusToday.label).toBe('DUE TODAY');

        // When current date is 16/09/2026 -> OVERDUE
        const statusAfter = getProductionDateStatus(productionDate, '2026-09-16');
        expect(statusAfter.code).toBe('OVERDUE');
        expect(statusAfter.label).toBe('OVERDUE');
      });
    });

    describe('Step 14 & 15 — Calendar day arithmetic and Next Days filtering', () => {
      it('adds calendar days accurately across months', () => {
        expect(addCalendarDays('2026-09-15', 7)).toBe('2026-09-22');
        expect(addCalendarDays('2026-09-25', 7)).toBe('2026-10-02');
        expect(addCalendarDays('2026-09-15', 14)).toBe('2026-09-29');
      });

      it('evaluates isDateInNextDays correctly for Next 7 and Next 14 Days', () => {
        const currentDate = '2026-09-15';

        // Next 7 days: 2026-09-15 through 2026-09-22
        expect(isDateInNextDays('2026-09-15', 7, currentDate)).toBe(true);  // Today (in range)
        expect(isDateInNextDays('2026-09-20', 7, currentDate)).toBe(true);  // In range
        expect(isDateInNextDays('2026-09-22', 7, currentDate)).toBe(true);  // Boundary
        expect(isDateInNextDays('2026-09-23', 7, currentDate)).toBe(false); // Beyond 7 days
        expect(isDateInNextDays('2026-09-14', 7, currentDate)).toBe(false); // Past date (overdue)

        // Next 14 days: 2026-09-15 through 2026-09-29
        expect(isDateInNextDays('2026-09-25', 14, currentDate)).toBe(true); // In 14 days range
        expect(isDateInNextDays('2026-09-29', 14, currentDate)).toBe(true); // Boundary
        expect(isDateInNextDays('2026-09-30', 14, currentDate)).toBe(false); // Beyond 14 days
      });
    });

    describe('Step 29–32 — Multi-Product SC Scenarios & SC vs Product Independence', () => {
      it('evaluates product dates and SC production date independently (SC 1571 scenario)', () => {
        const currentDate = '2026-09-11';
        const sc1571Items = [
          { product: 'Product A', projectedDate: '10/09/2026' }, // 2026-09-10 (Overdue)
          { product: 'Product B', projectedDate: '15/09/2026' }, // 2026-09-15 (Upcoming)
          { product: 'Product C', projectedDate: '20/09/2026' }, // 2026-09-20 (Upcoming)
        ];

        // Product A is OVERDUE
        const prodAStatus = getProductionDateStatus(sc1571Items[0].projectedDate, currentDate);
        expect(prodAStatus.code).toBe('OVERDUE');

        // Product B is UPCOMING
        const prodBStatus = getProductionDateStatus(sc1571Items[1].projectedDate, currentDate);
        expect(prodBStatus.code).toBe('UPCOMING');

        // Product C is UPCOMING
        const prodCStatus = getProductionDateStatus(sc1571Items[2].projectedDate, currentDate);
        expect(prodCStatus.code).toBe('UPCOMING');

        // SC Production Date is MAX (2026-09-20)
        const scProdDate = calculateSCProductionDate(sc1571Items);
        expect(scProdDate).toBe('2026-09-20');

        // SC Status is UPCOMING (not OVERDUE, because SC date is 20/09/2026)
        const scStatus = getProductionDateStatus(scProdDate, currentDate);
        expect(scStatus.code).toBe('UPCOMING');
      });

      it('handles SC with partial missing child product dates', () => {
        const currentDate = '2026-09-11';
        const items = [
          { product: 'Product A', projectedDate: '15/09/2026' },
          { product: 'Product B', projectedDate: null },
          { product: 'Product C', projectedDate: '20/09/2026' },
        ];

        expect(getProductionDateStatus(items[0].projectedDate, currentDate).code).toBe('UPCOMING');
        expect(getProductionDateStatus(items[1].projectedDate, currentDate).code).toBe('NO_DATE');
        expect(getProductionDateStatus(items[2].projectedDate, currentDate).code).toBe('UPCOMING');

        const scProdDate = calculateSCProductionDate(items);
        expect(scProdDate).toBe('2026-09-20');
        expect(getProductionDateStatus(scProdDate, currentDate).code).toBe('UPCOMING');
      });

      it('handles SC with all missing child product dates', () => {
        const currentDate = '2026-09-11';
        const items = [
          { product: 'Product A', projectedDate: null },
          { product: 'Product B', projectedDate: '' },
          { product: 'Product C', projectedDate: '—' },
        ];

        expect(getProductionDateStatus(items[0].projectedDate, currentDate).code).toBe('NO_DATE');
        expect(getProductionDateStatus(items[1].projectedDate, currentDate).code).toBe('NO_DATE');
        expect(getProductionDateStatus(items[2].projectedDate, currentDate).code).toBe('NO_DATE');

        const scProdDate = calculateSCProductionDate(items);
        expect(scProdDate).toBeNull();
        expect(getProductionDateStatus(scProdDate, currentDate).code).toBe('NO_DATE');
      });
    });

    describe('Step 36 — Date Analytics KPI Counts & Mathematical Reconciliation', () => {
      it('guarantees that Total SCs === Upcoming + Due Today + Overdue + No Date', () => {
        const currentDate = '2026-09-15';
        const scList = [
          { sc: '101', scProductionDate: '2026-09-10' }, // OVERDUE
          { sc: '102', scProductionDate: '2026-09-14' }, // OVERDUE
          { sc: '103', scProductionDate: '2026-09-15' }, // DUE_TODAY
          { sc: '104', scProductionDate: '2026-09-18' }, // UPCOMING (within 7d)
          { sc: '105', scProductionDate: '2026-09-25' }, // UPCOMING (within 14d)
          { sc: '106', scProductionDate: '2026-10-10' }, // UPCOMING (beyond 14d)
          { sc: '107', scProductionDate: null },         // NO_DATE
          { sc: '108', scProductionDate: '' },           // NO_DATE
        ];

        let total = scList.length;
        let upcoming = 0;
        let dueToday = 0;
        let overdue = 0;
        let noDate = 0;

        scList.forEach((sc) => {
          const status = getProductionDateStatus(sc.scProductionDate, currentDate);
          if (status.code === 'UPCOMING') upcoming++;
          else if (status.code === 'DUE_TODAY') dueToday++;
          else if (status.code === 'OVERDUE') overdue++;
          else if (status.code === 'NO_DATE') noDate++;
        });

        expect(total).toBe(8);
        expect(overdue).toBe(2);
        expect(dueToday).toBe(1);
        expect(upcoming).toBe(3);
        expect(noDate).toBe(2);

        // Mathematical reconciliation invariant:
        expect(total).toBe(upcoming + dueToday + overdue + noDate);

        // Sub-filter counts:
        const next7Count = scList.filter(sc => isDateInNextDays(sc.scProductionDate, 7, currentDate)).length;
        const next14Count = scList.filter(sc => isDateInNextDays(sc.scProductionDate, 14, currentDate)).length;
        expect(next7Count).toBe(2); // 2026-09-15 (today) and 2026-09-18
        expect(next14Count).toBe(3); // 2026-09-15, 2026-09-18, 2026-09-25
      });
    });

    describe('Step 42 — Complete Phase 7 Acceptance Scenario Sequence', () => {
      it('executes the full end-to-end Phase 7 acceptance workflow correctly', () => {
        const currentDate = '2026-09-15';

        // 1. Initial State: SC 1571 with 3 products
        const sc1571Products = [
          { product: 'Gauge X', projectedDate: '2026-09-10' }, // OVERDUE
          { product: 'Gauge Y', projectedDate: '2026-09-15' }, // DUE_TODAY
          { product: 'Gauge Z', projectedDate: '2026-09-20' }, // UPCOMING
        ];

        // 2. SC Production Date = MAX (2026-09-20) -> UPCOMING
        const scProdDate = calculateSCProductionDate(sc1571Products);
        expect(scProdDate).toBe('2026-09-20');
        expect(getProductionDateStatus(scProdDate, currentDate).code).toBe('UPCOMING');

        // 3. Child products retain individual status badges
        expect(getProductionDateStatus(sc1571Products[0].projectedDate, currentDate).code).toBe('OVERDUE');
        expect(getProductionDateStatus(sc1571Products[1].projectedDate, currentDate).code).toBe('DUE_TODAY');
        expect(getProductionDateStatus(sc1571Products[2].projectedDate, currentDate).code).toBe('UPCOMING');

        // 4. Update Product Z date to today (2026-09-15)
        sc1571Products[2].projectedDate = '2026-09-15';
        const updatedScProdDate = calculateSCProductionDate(sc1571Products);
        expect(updatedScProdDate).toBe('2026-09-15');
        // SC status is now DUE TODAY
        expect(getProductionDateStatus(updatedScProdDate, currentDate).code).toBe('DUE_TODAY');

        // 5. Update Product Y & Z dates to past date (2026-09-12)
        sc1571Products[1].projectedDate = '2026-09-12';
        sc1571Products[2].projectedDate = '2026-09-12';
        const overdueScProdDate = calculateSCProductionDate(sc1571Products);
        expect(overdueScProdDate).toBe('2026-09-12');
        // SC status is now OVERDUE
        expect(getProductionDateStatus(overdueScProdDate, currentDate).code).toBe('OVERDUE');
      });
    });
  });

  describe('calculateProductProjectedDate & canonicalProcess', () => {
    it('normalizes stage aliases correctly', () => {
      expect(canonicalProcess('CGV-V8')).toBe('CG');
      expect(canonicalProcess('FBV-V2')).toBe('TURNING');
      expect(canonicalProcess('BRV-V13')).toBe('BRASSING');
      expect(canonicalProcess('M1I')).toBe('M1');
      expect(canonicalProcess('M1-1')).toBe('M1');
      expect(canonicalProcess('READY')).toBe('DONE');
      expect(canonicalProcess('STORES')).toBe('DONE');
    });

    it('returns timestamp date for completed stages', () => {
      const res = calculateProductProjectedDate({
        product: 'ARG 10mm',
        currentStage: 'READY',
        timestamp: '2026-09-11 10:00:00',
      });
      expect(res.isDone).toBe(true);
      expect(res.projectedDate).toBe('2026-09-11');
      expect(res.remainingDays).toBe(0);
      expect(res.formatted).toBe('11/09/2026');
    });

    it('calculates dynamic projected date from template with elapsed days', () => {
      const res = calculateProductProjectedDate({
        product: 'ARG 10mm',
        family: 'ARG',
        template: 'ARG_6_To_20_VBM_HBM',
        currentStage: 'M1',
        timestamp: '2026-09-01 00:00:00',
        todayStr: '2026-09-11',
      });
      expect(res).not.toBeNull();
      expect(res.isDone).toBe(false);
      expect(res.projectedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(res.remainingDays).toBeGreaterThan(0);
    });
  });

  describe('Vendor Master Mapping & Identification', () => {
    it('correctly maps all 22 written notes vendors', () => {
      expect(VENDOR_MAP['V1'].name).toBe('Abi');
      expect(VENDOR_MAP['V2'].name).toBe('RK Engg');
      expect(VENDOR_MAP['V3'].name).toBe('Shiva Shakthi');
      expect(VENDOR_MAP['V4'].name).toBe('Fine Turn');
      expect(VENDOR_MAP['V6'].name).toBe('NVCNC');
      expect(VENDOR_MAP['V7'].name).toBe('Micro Mac');
      expect(VENDOR_MAP['V8'].name).toBe('Skyline');
      expect(VENDOR_MAP['V10'].name).toBe('Std Engg');
      expect(VENDOR_MAP['V11'].name).toBe('Flame Tech / HTV');
      expect(VENDOR_MAP['V12'].name).toBe('Mech Tools');
      expect(VENDOR_MAP['V13'].name).toBe('VS Engg');
      expect(VENDOR_MAP['V14'].name).toBe('RKV Metal');
      expect(VENDOR_MAP['V15'].name).toBe('Metal Form');
      expect(VENDOR_MAP['V16'].name).toBe('Export');
      expect(VENDOR_MAP['V17'].name).toBe('Sivam');
      expect(VENDOR_MAP['V18'].name).toBe('JMC / Pre Tooling');
      expect(VENDOR_MAP['V19'].name).toBe('PS Coating');
      expect(VENDOR_MAP['V24'].name).toBe('Nisha Tools');
      expect(VENDOR_MAP['V26'].name).toBe('GA Tools');
      expect(VENDOR_MAP['V27'].name).toBe('JV Tools');
      expect(VENDOR_MAP['V35'].name).toBe('GSM');
      expect(VENDOR_MAP['V38'].name).toBe('SMV Engg');
    });

    it('identifies vendor info from raw stage codes and aliases', () => {
      // FBV-VQ -> V1 (Abi)
      const v1Info = getVendorInfo('FBV-VQ');
      expect(v1Info.code).toBe('V1');
      expect(v1Info.name).toBe('Abi');
      expect(v1Info.operation).toBe('FBV');
      expect(v1Info.fullName).toBe('Abi (V1)');

      // BRV-V13 -> V13 (VS Engg)
      const v13Info = getVendorInfo('BRV-V13');
      expect(v13Info.code).toBe('V13');
      expect(v13Info.name).toBe('VS Engg');
      expect(v13Info.operation).toBe('BRV');
      expect(v13Info.fullName).toBe('VS Engg (V13)');

      // CGV-V8 -> V8 (Skyline)
      const v8Info = getVendorInfo('CGV-V8');
      expect(v8Info.code).toBe('V8');
      expect(v8Info.name).toBe('Skyline');
      expect(v8Info.operation).toBe('CGV');

      // SDV-V6 -> V6 (NVCNC)
      const v6Info = getVendorInfo('SDV-V6');
      expect(v6Info.code).toBe('V6');
      expect(v6Info.name).toBe('NVCNC');

      // PTV-V18 -> V18 (JMC / Pre Tooling)
      const v18Info = getVendorInfo('PTV-V18');
      expect(v18Info.code).toBe('V18');
      expect(v18Info.name).toBe('JMC / Pre Tooling');

      // HTV-V11 -> V11 (Flame Tech / HTV)
      const v11Info = getVendorInfo('HTV-V11');
      expect(v11Info.code).toBe('V11');
      expect(v11Info.name).toBe('Flame Tech / HTV');

      // ODCGV-V35 -> V35 (GSM)
      const v35Info = getVendorInfo('ODCGV-V35');
      expect(v35Info.code).toBe('V35');
      expect(v35Info.name).toBe('GSM');
    });

    it('returns empty info for in-house processes and exclusions', () => {
      expect(getVendorInfo('RM_01')).toBeNull();
      expect(getVendorInfo('SAMPLE')).toBeNull();
      expect(getVendorInfo('LAPPING')).toBeNull();
      expect(getVendorInfo('LATHE')).toBeNull();
      expect(getVendorInfo('QC_MAC')).toBeNull();
      expect(getVendorInfo('READY')).toBeNull();
      expect(getVendorInfo('M1')).toBeNull();
      expect(getVendorInfo('VBM')).toBeNull();
    });

    it('correctly reads vendor info from row object', () => {
      const row = { currentStage: 'FBV-V2', inhouse: false };
      expect(getVendorCode(row)).toBe('V2');
      expect(getVendorName(row)).toBe('RK Engg');

      const inhouseRow = { currentStage: 'M1', inhouse: true };
      expect(getVendorCode(inhouseRow)).toBeNull();
      expect(getVendorName(inhouseRow)).toBeNull();
    });
  });
});

