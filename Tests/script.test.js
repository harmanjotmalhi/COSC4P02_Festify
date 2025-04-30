/**
 * @jest-environment jsdom
 */

// Mock the firebase.js module BEFORE importing script.js
jest.mock('../firebase.js');

// Only import utility functions that don't rely on DOM manipulation
import {
  formatDate,
  formatCurrency
} from '../script.js';

describe('script.js utility functions', () => {
  test('formatDate() should format date strings', () => {
    const formatted = formatDate("2024-06-15");
    // Since toLocaleDateString may vary, check for key parts
    expect(formatted).toMatch(/2024/);
    expect(formatted).toMatch(/June|6/);
  });

  test('formatCurrency() should format numbers as USD', () => {
    const formatted = formatCurrency(12500);
    expect(formatted).toContain('$');
    expect(formatted).toContain('12,500');
  });
});
