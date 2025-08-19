export type CacheKeyArgs = {
  url: string;
  strategy?: 'mobile' | 'desktop' | (string & {});
  categories?: string[];
};

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = '';
    u.searchParams.forEach((_v, k) => {
      if (k.toLowerCase().startsWith('utm_')) u.searchParams.delete(k);
    });
    if (u.pathname !== '/' && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return raw;
  }
}

export function makeCacheKey({ url, strategy = 'mobile', categories = [] }: CacheKeyArgs): string {
  const cleanUrl = normalizeUrl(url);
  const cats = (Array.isArray(categories) ? categories : []).slice().sort().join(',');
  return `ps:${cleanUrl}:${strategy}:${cats}`;
}
