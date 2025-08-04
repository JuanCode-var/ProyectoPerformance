// src/cacheKey.js
// Genera una clave de caché estable para una combinación URL + estrategia + categorías

export function makeCacheKey({
  url,
  strategy = 'mobile',
  categories = ['performance'],
} = {}) {
  if (!url) {
    throw new Error('url is required to build cache key');
  }

  // 1. Normalizar la URL
  let cleanUrl = url.trim();

  // Si por error viene duplicada ("https://foo/https://foo"), conserva solo la primera parte
  const protocolMatches = cleanUrl.match(/https?:\/\//g);
  if (protocolMatches && protocolMatches.length > 1) {
    const secondProtocolIdx = cleanUrl.indexOf('http', 1);
    cleanUrl = cleanUrl.slice(0, secondProtocolIdx);
  }

  // Quitar barra final y pasar a minúsculas
  cleanUrl = cleanUrl.replace(/\/$/, '').toLowerCase();

  // 2. Ordenar categorías para que el orden no afecte la clave
  const cats = [...categories].sort();

  // 3. Construir la clave definitiva
  return `audit:${cleanUrl}:${strategy}:${cats.join(',')}`;
}
