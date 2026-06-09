import { describe, it, expect } from 'vitest';
import { 
  workingDaysBetween, 
  getProductCategory, 
  parseDateTime,
  isSLAViolation,
  calculateProcessEfficiency
} from '../../utils/calculationUtils';

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
});
