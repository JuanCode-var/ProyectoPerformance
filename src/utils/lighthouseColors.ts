export function perfColor(score) {
  if (score >= 90) return '#00c853'; // verde
  if (score >= 50) return '#ffeb3b'; // amarillo
  return '#d50000';                  // rojo
}

export const thresholds = {
  fcp:  { good: 1800, needs: 3000 },
  lcp:  { good: 2500, needs: 4000 },
  cls:  { good: 0.1, needs: 0.25 },
  tbt:  { good: 200, needs: 600 },
  si:   { good: 3400, needs: 5800 },
  ttfb: { good: 800, needs: 1800 },
};

export function metricColor(value, metric) {
  if (value == null) return '#9e9e9e';
  const { good, needs } = thresholds[metric] || {};
  if (good == null) return '#9e9e9e';
  if (metric === 'cls') {
    if (value <= good) return '#00c853';
    if (value <= needs) return '#ffeb3b';
    return '#d50000';
  }
  if (value <= good) return '#00c853';
  if (value <= needs) return '#ffeb3b';
  return '#d50000';
}
