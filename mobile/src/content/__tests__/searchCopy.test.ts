import { MAP_SEARCH_COPY, PREDICTIONS_SEARCH_COPY } from '../searchCopy';

describe('searchCopy', () => {
  it('map search mentions Melbourne CBD, streets, and landmarks', () => {
    expect(MAP_SEARCH_COPY.placeholder).toMatch(/Melbourne CBD/i);
    expect(MAP_SEARCH_COPY.placeholder).toMatch(/streets.*landmarks/i);
    expect(MAP_SEARCH_COPY.dropdownSection).toMatch(/Melbourne CBD/i);
    expect(MAP_SEARCH_COPY.emptyHint).toMatch(/Melbourne CBD/i);
  });

  it('predictions search mentions Melbourne CBD street', () => {
    expect(PREDICTIONS_SEARCH_COPY.placeholder).toMatch(/Melbourne CBD street/i);
    expect(PREDICTIONS_SEARCH_COPY.placeholder).not.toMatch(/suburb/i);
  });
});
