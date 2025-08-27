import { describe, it, expect } from 'vitest';
import { 
  compareHealthFactors, 
  isLiquidatable, 
  isBelowRecommended, 
  formatHealthFactorFromString,
  getHealthFactorColorClassFromString 
} from '../healthFactorUtils';

describe('healthFactorUtils', () => {
  describe('compareHealthFactors', () => {
    it('should correctly compare numeric health factors', () => {
      expect(compareHealthFactors('2.5', '1.5')).toBe(1); // 2.5 > 1.5
      expect(compareHealthFactors('1.5', '2.5')).toBe(-1); // 1.5 < 2.5
      expect(compareHealthFactors('2.0', '2.0')).toBe(0); // 2.0 === 2.0
    });

    it('should handle infinite health factor', () => {
      expect(compareHealthFactors('∞', '2.5')).toBe(1); // ∞ > 2.5
      expect(compareHealthFactors('2.5', '∞')).toBe(-1); // 2.5 < ∞
      expect(compareHealthFactors('∞', '∞')).toBe(0); // ∞ === ∞
    });

    it('should handle zero health factor', () => {
      expect(compareHealthFactors('0', '1.5')).toBe(-1); // 0 < 1.5
      expect(compareHealthFactors('1.5', '0')).toBe(1); // 1.5 > 0
    });

    it('should handle edge cases with very small differences', () => {
      expect(compareHealthFactors('1.500001', '1.5')).toBe(1);
      expect(compareHealthFactors('1.5', '1.500001')).toBe(-1);
    });
  });

  describe('isLiquidatable', () => {
    it('should identify liquidatable positions', () => {
      expect(isLiquidatable('1.1', '1.2')).toBe(true); // Below threshold
      expect(isLiquidatable('0.9', '1.2')).toBe(true); // Well below threshold
    });

    it('should identify safe positions', () => {
      expect(isLiquidatable('1.3', '1.2')).toBe(false); // Above threshold
      expect(isLiquidatable('2.5', '1.2')).toBe(false); // Well above threshold
    });

    it('should handle edge case at threshold', () => {
      expect(isLiquidatable('1.2', '1.2')).toBe(false); // Exactly at threshold
    });

    it('should handle infinite health factor', () => {
      expect(isLiquidatable('∞', '1.2')).toBe(false); // Infinite is safe
    });

    it('should handle zero health factor', () => {
      expect(isLiquidatable('0', '1.2')).toBe(true); // Zero is liquidatable
    });
  });

  describe('isBelowRecommended', () => {
    const recommendedLevel = '2.0';

    it('should identify positions below recommended level', () => {
      expect(isBelowRecommended('1.8', recommendedLevel)).toBe(true);
      expect(isBelowRecommended('1.2', recommendedLevel)).toBe(true);
    });

    it('should identify safe positions', () => {
      expect(isBelowRecommended('2.1', recommendedLevel)).toBe(false);
      expect(isBelowRecommended('3.5', recommendedLevel)).toBe(false);
    });

    it('should handle edge case at recommended level', () => {
      expect(isBelowRecommended('2.0', recommendedLevel)).toBe(false);
    });

    it('should handle infinite health factor', () => {
      expect(isBelowRecommended('∞', recommendedLevel)).toBe(false);
    });
  });

  describe('formatHealthFactorFromString', () => {
    it('should format numeric health factors', () => {
      expect(formatHealthFactorFromString('2.5')).toBe('2.50');
      expect(formatHealthFactorFromString('1.23456')).toBe('1.23');
      expect(formatHealthFactorFromString('10.1')).toBe('10.10');
    });

    it('should handle infinite health factor', () => {
      expect(formatHealthFactorFromString('∞')).toBe('∞');
      expect(formatHealthFactorFromString('Infinity')).toBe('∞');
    });

    it('should handle zero and very small values', () => {
      expect(formatHealthFactorFromString('0')).toBe('0.00');
      expect(formatHealthFactorFromString('0.001')).toBe('0.00');
    });

    it('should handle very large values', () => {
      expect(formatHealthFactorFromString('1000')).toBe('∞'); // Large values treated as infinite
      expect(formatHealthFactorFromString('999.9')).toBe('∞');
    });

    it('should handle invalid input gracefully', () => {
      expect(formatHealthFactorFromString('invalid')).toBe('0.00');
      expect(formatHealthFactorFromString('')).toBe('0.00');
    });
  });

  describe('getHealthFactorColorClassFromString', () => {
    it('should return danger color for liquidatable health factors', () => {
      expect(getHealthFactorColorClassFromString('1.1')).toContain('text-red');
      expect(getHealthFactorColorClassFromString('0.8')).toContain('text-red');
    });

    it('should return warning color for low health factors', () => {
      expect(getHealthFactorColorClassFromString('1.8')).toContain('text-yellow');
      expect(getHealthFactorColorClassFromString('1.5')).toContain('text-yellow');
    });

    it('should return success color for safe health factors', () => {
      expect(getHealthFactorColorClassFromString('2.5')).toContain('text-green');
      expect(getHealthFactorColorClassFromString('3.0')).toContain('text-green');
    });

    it('should return success color for infinite health factor', () => {
      expect(getHealthFactorColorClassFromString('∞')).toContain('text-green');
    });

    it('should handle edge cases', () => {
      expect(getHealthFactorColorClassFromString('0')).toContain('text-red');
      expect(getHealthFactorColorClassFromString('2.0')).toContain('text-yellow'); // Just at warning threshold
    });
  });
});