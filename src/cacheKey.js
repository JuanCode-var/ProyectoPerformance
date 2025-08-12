// Genera una clave de caché estable para una combinación URL + estrategia + categorías

export function normalizeUrl(raw) {
  try {
    const u = new URL(raw);
    u.hash = '';
    // limpia UTM
    u.searchParams.forEach((v, k) => {
      if (k.toLowerCase().startsWith('utm_')) u.searchParams.delete(k);
    });
    // quita slash final
    if (u.pathname !== '/' && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return raw;
  }
}

export function makeCacheKey({ url, strategy = 'mobile', categories = [] }) {
  const cleanUrl = normalizeUrl(url);
  const cats = [...(categories || [])].sort().join(',');
  return `ps:${cleanUrl}:${strategy}:${cats}`;
} 