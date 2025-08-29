import { describe, it, expect } from 'vitest';
import { cn } from '../utils';

describe('utils.ts', () => {
  describe('cn function', () => {
    describe('Core Functionality', () => {
      it('should merge single class name', () => {
        const result = cn('text-center');
        expect(result).toBe('text-center');
      });

      it('should merge multiple class names', () => {
        const result = cn('text-center', 'bg-blue-500', 'p-4');
        expect(result).toBe('text-center bg-blue-500 p-4');
      });

      it('should handle conditional classes with clsx', () => {
        const isActive = true;
        const isDisabled = false;

        const result = cn(
          'base-class',
          isActive && 'active-class',
          isDisabled && 'disabled-class'
        );

        expect(result).toBe('base-class active-class');
      });

      it('should merge conflicting Tailwind classes correctly', () => {
        const result = cn('p-2 p-4');
        expect(result).toBe('p-4');
      });

      it('should handle complex Tailwind class conflicts', () => {
        const result = cn('bg-red-500 bg-blue-500 text-white text-black');
        expect(result).toBe('bg-blue-500 text-black');
      });
    });

    describe('Input Types', () => {
      it('should handle undefined values', () => {
        const result = cn('text-center', undefined, 'bg-blue-500');
        expect(result).toBe('text-center bg-blue-500');
      });

      it('should handle null values', () => {
        const result = cn('text-center', null, 'bg-blue-500');
        expect(result).toBe('text-center bg-blue-500');
      });

      it('should handle empty strings', () => {
        const result = cn('text-center', '', 'bg-blue-500');
        expect(result).toBe('text-center bg-blue-500');
      });

      it('should handle arrays of class names', () => {
        const result = cn(['text-center', 'bg-blue-500'], 'p-4');
        expect(result).toBe('text-center bg-blue-500 p-4');
      });

      it('should handle objects with boolean values', () => {
        const result = cn('base-class', {
          'active': true,
          'disabled': false,
          'highlighted': true
        });

        expect(result).toBe('base-class active highlighted');
      });

      it('should handle mixed input types', () => {
        const result = cn(
          'base-class',
          ['array-class-1', 'array-class-2'],
          {
            'conditional-class': true,
            'false-class': false
          },
          'final-class',
          null,
          undefined
        );

        expect(result).toBe('base-class array-class-1 array-class-2 conditional-class final-class');
      });
    });

    describe('Edge Cases', () => {
      it('should handle no arguments', () => {
        const result = cn();
        expect(result).toBe('');
      });

      it('should handle only falsy values', () => {
        const result = cn(null, undefined, false, '');
        expect(result).toBe('');
      });

      it('should handle deep nesting in arrays', () => {
        const result = cn(['class-1', ['nested-class-1', 'nested-class-2']], 'class-2');
        expect(result).toBe('class-1 nested-class-1 nested-class-2 class-2');
      });

      it('should handle complex responsive Tailwind classes', () => {
        const result = cn(
          'text-sm md:text-base lg:text-lg',
          'text-base md:text-lg lg:text-xl'
        );
        
        // Should merge similar prefixes correctly
        expect(result).toContain('lg:text-xl');
      });

      it('should preserve custom CSS classes that don\'t conflict', () => {
        const result = cn('custom-component', 'tailwind-class', 'another-custom-class');
        expect(result).toBe('custom-component tailwind-class another-custom-class');
      });
    });

    describe('Performance and Consistency', () => {
      it('should return consistent results for same inputs', () => {
        const input1 = ['bg-red-500', 'bg-blue-500', 'text-white'];
        const input2 = ['bg-red-500', 'bg-blue-500', 'text-white'];

        const result1 = cn(...input1);
        const result2 = cn(...input2);

        expect(result1).toBe(result2);
      });

      it('should handle large number of class names efficiently', () => {
        const manyClasses = Array.from({ length: 100 }, (_, i) => `class-${i}`);
        const result = cn(...manyClasses);
        
        expect(result).toContain('class-0');
        expect(result).toContain('class-99');
        expect(typeof result).toBe('string');
      });

      it('should handle complex conditional logic combinations', () => {
        const size = 'large';
        const variant = 'primary';
        const disabled = false;
        const loading = true;

        const result = cn(
          'button-base',
          {
            'button-small': size === 'small',
            'button-medium': size === 'medium', 
            'button-large': size === 'large',
          },
          variant === 'primary' && 'button-primary',
          variant === 'secondary' && 'button-secondary',
          disabled && 'button-disabled',
          loading && 'button-loading'
        );

        expect(result).toBe('button-base button-large button-primary button-loading');
      });
    });
  });
});