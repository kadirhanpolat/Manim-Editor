import { ref, computed } from 'vue';

/** A single font item returned by /api/fonts. */
export interface FontItem {
  family: string;
  category?: string;
  [k: string]: unknown;
}

interface FontsApiResponse {
  fonts: FontItem[];
  total: number;
}

interface LoadOptions {
  search?: string;
  category?: string;
  reset?: boolean;
}

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

// Data layer for the font picker: paginated /api/fonts fetch + Google Fonts preview
// stylesheet injection. UI state (open/search/highlight/category) stays in the component;
// this owns only the fetched list + pagination. Search/category are passed per call.
export function useGoogleFonts() {
  const fonts = ref<FontItem[]>([]);
  const loading = ref(false);
  const total = ref(0);
  const offset = ref(0);
  const limit = ref(50);
  // Dedup cache for injected <link> stylesheets — not reactive (never rendered).
  const previewStylesLoaded = new Set<string>();

  // More remain to load iff we have fewer than the total filtered count. (`offset` is
  // kept only as the next fetch's start index — using it here double-counted, since it is
  // set to `fonts.length` after each fetch, which prematurely hid "Load more".)
  const hasMore = computed(() => fonts.value.length < total.value);

  function loadPreviewStyles(fontItems: FontItem[]): void {
    const fontsToLoad = fontItems.filter((f) => !previewStylesLoaded.has(f.family));
    if (fontsToLoad.length === 0) return;

    const families = fontsToLoad.map((f) => f.family.replace(/ /g, '+')).join('|');
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    fontsToLoad.forEach((f) => previewStylesLoaded.add(f.family));
  }

  async function load({
    search = '',
    category = 'all',
    reset = false,
  }: LoadOptions = {}): Promise<void> {
    if (loading.value) return;

    loading.value = true;

    try {
      const params = new URLSearchParams({
        limit: String(limit.value),
        offset: String(reset ? 0 : offset.value),
      });

      if (search) {
        params.set('search', search);
      }

      if (category !== 'all') {
        params.set('category', category);
      }

      const response = await fetch(`${API_BASE}/api/fonts?${params}`);
      const data = (await response.json()) as FontsApiResponse;

      if (reset) {
        fonts.value = data.fonts;
        offset.value = 0;
      } else {
        fonts.value = [...fonts.value, ...data.fonts];
      }

      total.value = data.total;
      offset.value = fonts.value.length;

      // Load Google Fonts preview styles for visible fonts
      loadPreviewStyles(data.fonts.slice(0, 20));
    } catch (error) {
      console.error('Error fetching fonts:', error);
    } finally {
      loading.value = false;
    }
  }

  return { fonts, loading, hasMore, load };
}
