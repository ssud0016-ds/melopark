import { ONBOARDING_STEPS } from '../OnboardingOverlay';

describe('ONBOARDING_STEPS', () => {
  test('covers map, search/planning, and prediction guidance', () => {
    const text = ONBOARDING_STEPS.map((step) => `${step.title} ${step.body} ${step.hint}`).join(' ');

    expect(ONBOARDING_STEPS).toHaveLength(3);
    expect(text).toMatch(/parking bay/i);
    expect(text).toMatch(/Search tab/i);
    expect(text).toMatch(/Predictions/i);
    expect(ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1].cta).toBe('Done');
  });
});
