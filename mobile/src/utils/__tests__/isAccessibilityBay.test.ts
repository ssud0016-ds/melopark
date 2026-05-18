import { isAccessibilityBay } from '../isAccessibilityBay';

describe('isAccessibilityBay', () => {
  test('accepts disability signage tags', () => {
    expect(isAccessibilityBay({ bayType: 'Disabled' })).toBe(true);
    expect(isAccessibilityBay({ bayType: 'DIS ONLY' })).toBe(true);
    expect(isAccessibilityBay({ bayType: 'dis' })).toBe(true);
  });

  test('rejects other bay types', () => {
    expect(isAccessibilityBay({ bayType: 'Other' })).toBe(false);
    expect(isAccessibilityBay({ bayType: 'Loading Zone' })).toBe(false);
  });
});
