import { describe, expect, it } from 'vitest';
import { compareVersions } from '../compareVersions';

describe('compareVersions', () => {
  it('should correctly compare semantic version strings', () => {
    expect(compareVersions('1.0.0', '1.1.0')).toBeLessThan(0);
    expect(compareVersions('1.1.0', '1.1.0')).toBe(0);
    expect(compareVersions('1.2.0', '1.1.0')).toBeGreaterThan(0);
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
  });
});
