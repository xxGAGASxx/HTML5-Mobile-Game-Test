import { expect, it } from 'vitest';
import { formatNumber } from './format';

it('abbreviates large numbers', () => {
  expect(formatNumber(950)).toBe('950');
  expect(formatNumber(1234)).toBe('1.2K');
  expect(formatNumber(56_000)).toBe('56K');
  expect(formatNumber(3_400_000)).toBe('3.4M');
});
