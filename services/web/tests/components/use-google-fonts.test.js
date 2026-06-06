import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGoogleFonts } from '../../src/components/inspector/useGoogleFonts.js';

function page(fonts, total) {
  return { json: async () => ({ fonts, total }) };
}

let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn(async () => page([{ family: 'Roboto', category: 'sans-serif' }], 50));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useGoogleFonts', () => {
  it('reset replaces the list', async () => {
    const g = useGoogleFonts();
    await g.load({ reset: true });
    expect(g.fonts.value.map(f => f.family)).toEqual(['Roboto']);
    expect(g.loading.value).toBe(false);
  });

  it('append (reset:false) concatenates pages', async () => {
    fetchMock
      .mockResolvedValueOnce(page([{ family: 'A', category: 'serif' }], 50))
      .mockResolvedValueOnce(page([{ family: 'B', category: 'serif' }], 50));
    const g = useGoogleFonts();
    await g.load({ reset: true });
    await g.load({ reset: false });
    expect(g.fonts.value.map(f => f.family)).toEqual(['A', 'B']);
  });

  it('builds the query with search + non-all category, omits category=all', async () => {
    const g = useGoogleFonts();
    await g.load({ search: 'mono', category: 'monospace', reset: true });
    const url = fetchMock.mock.calls[0][0];
    expect(url).toContain('offset=0');
    expect(url).toContain('search=mono');
    expect(url).toContain('category=monospace');

    await g.load({ category: 'all', reset: true });
    expect(fetchMock.mock.calls[1][0]).not.toContain('category=');
  });

  it('hasMore reflects offset + fonts.length < total (the original formula)', async () => {
    fetchMock.mockResolvedValue(page([{ family: 'A', category: 'x' }, { family: 'B', category: 'x' }], 5));
    const g = useGoogleFonts();
    await g.load({ reset: true });
    expect(g.hasMore.value).toBe(true);   // offset(2) + len(2) = 4 < 5
  });

  it('injects each preview stylesheet family only once (dedup)', async () => {
    const appendSpy = vi.spyOn(document.head, 'appendChild').mockImplementation((el) => el);
    fetchMock
      .mockResolvedValueOnce(page([{ family: 'Roboto', category: 'x' }, { family: 'Lato', category: 'x' }], 50))
      .mockResolvedValueOnce(page([{ family: 'Lato', category: 'x' }, { family: 'Open Sans', category: 'x' }], 50));
    const g = useGoogleFonts();
    await g.load({ reset: true });
    await g.load({ reset: false });
    const hrefs = appendSpy.mock.calls.map(c => c[0].href);
    expect(appendSpy).toHaveBeenCalledTimes(2);
    expect(hrefs[0]).toContain('Roboto');
    expect(hrefs[0]).toContain('Lato');
    expect(hrefs[1]).toContain('Open');     // 'Open Sans' → 'Open+Sans'
    expect(hrefs[1]).not.toContain('Lato'); // already loaded → deduped
    appendSpy.mockRestore();
  });
});
