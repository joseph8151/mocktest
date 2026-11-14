// Small SVG generators for graph / geometry questions. Output is a standalone <svg> string
// (rendered through <img src="data:image/svg+xml">, so it is sandboxed and cannot run scripts).
const INK = '#1f2937', GRID = '#e5e7eb', COLORS = ['#059669', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
export const wrap = (w, h, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Helvetica,Arial,sans-serif" font-size="12" fill="${INK}">${inner}</svg>`;
const text = (x, y, s, o = '') => `<text x="${x}" y="${y}" ${o}>${esc(s)}</text>`;

function axes({ W, H, L, B, T, R, yMax, yStep, yLabel }) {
  let g = '';
  for (let v = 0; v <= yMax; v += yStep) {
    const y = B - ((B - T) * v) / yMax;
    g += `<line x1="${L}" y1="${y}" x2="${W - R}" y2="${y}" stroke="${GRID}"/>` + text(L - 6, y + 4, v, 'text-anchor="end" font-size="10"');
  }
  g += `<line x1="${L}" y1="${T}" x2="${L}" y2="${B}" stroke="${INK}"/><line x1="${L}" y1="${B}" x2="${W - R}" y2="${B}" stroke="${INK}"/>`;
  if (yLabel) g += text(12, (T + B) / 2, yLabel, `text-anchor="middle" font-size="10" transform="rotate(-90 12 ${(T + B) / 2})"`);
  return g;
}

export function barChart({ title, labels, values, yMax, yStep, yLabel, showValues = false, color = COLORS[0] }) {
  const W = 340, H = 230, L = 46, R = 12, T = 34, B = 188, n = labels.length, slot = (W - L - R) / n, bw = Math.min(40, slot * 0.6);
  let s = text(W / 2, 18, title, 'text-anchor="middle" font-weight="700" font-size="13"') + axes({ W, H, L, B, T, R, yMax, yStep, yLabel });
  values.forEach((v, i) => {
    const x = L + slot * i + (slot - bw) / 2, h = ((B - T) * v) / yMax;
    s += `<rect x="${x}" y="${B - h}" width="${bw}" height="${h}" fill="${color}" rx="2"/>` + text(x + bw / 2, B + 15, labels[i], 'text-anchor="middle" font-size="11"');
    if (showValues) s += text(x + bw / 2, B - h - 4, v, 'text-anchor="middle" font-size="10" font-weight="700"');
  });
  return wrap(W, H, s);
}

export function lineChart({ title, labels, values, yMax, yStep, yLabel, showValues = false }) {
  const W = 340, H = 230, L = 46, R = 16, T = 34, B = 188, n = labels.length, slot = (W - L - R) / (n - 1 || 1);
  const pts = values.map((v, i) => [L + 10 + ((slot - 0) * i * (W - L - R - 20)) / (W - L - R), B - ((B - T) * v) / yMax]);
  const px = (i) => L + 12 + (i * (W - L - R - 24)) / (n - 1 || 1);
  let s = text(W / 2, 18, title, 'text-anchor="middle" font-weight="700" font-size="13"') + axes({ W, H, L, B, T, R, yMax, yStep, yLabel });
  s += `<polyline fill="none" stroke="${COLORS[0]}" stroke-width="2.5" points="${values.map((v, i) => `${px(i)},${B - ((B - T) * v) / yMax}`).join(' ')}"/>`;
  values.forEach((v, i) => {
    const y = B - ((B - T) * v) / yMax;
    s += `<circle cx="${px(i)}" cy="${y}" r="4" fill="${COLORS[0]}"/>` + text(px(i), B + 15, labels[i], 'text-anchor="middle" font-size="11"');
    if (showValues) s += text(px(i), y - 8, v, 'text-anchor="middle" font-size="10" font-weight="700"');
  });
  void pts; return wrap(W, H, s);
}

export function pieChart({ title, parts }) { // parts: [{label, pct}] summing to 100
  const W = 340, H = 230, cx = 110, cy = 130, r = 78; let a0 = -Math.PI / 2, s = text(W / 2, 18, title, 'text-anchor="middle" font-weight="700" font-size="13"');
  parts.forEach((p, i) => {
    const a1 = a0 + (p.pct / 100) * 2 * Math.PI, large = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0, x1, y1] = [cx + r * Math.cos(a0), cy + r * Math.sin(a0), cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
    s += `<path d="M${cx} ${cy} L${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z" fill="${COLORS[i % 6]}" stroke="#fff" stroke-width="2"/>`;
    const am = (a0 + a1) / 2; s += text((cx + r * 0.62 * Math.cos(am)).toFixed(1), (cy + r * 0.62 * Math.sin(am) + 4).toFixed(1), `${p.pct}%`, 'text-anchor="middle" font-size="11" font-weight="700" fill="#fff"');
    s += `<rect x="215" y="${58 + i * 24}" width="12" height="12" rx="3" fill="${COLORS[i % 6]}"/>` + text(234, 69 + i * 24, p.label, 'font-size="12"');
    a0 = a1;
  });
  return wrap(W, H, s);
}

export function rectFig(w, h, { unit = 'cm', showArea = false } = {}) {
  const W = 260, H = 160, k = Math.min(150 / w, 90 / h), rw = w * k, rh = h * k, x = (W - rw) / 2, y = (H - rh) / 2;
  return wrap(W, H, `<rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="#e0e7ff" stroke="${INK}" stroke-width="2"/>` + text(W / 2, y - 6, `${w} ${unit}`, 'text-anchor="middle"') + text(x + rw + 8, H / 2 + 4, `${h} ${unit}`) + (showArea ? text(W / 2, H / 2 + 4, 'Not drawn to scale', 'text-anchor="middle" font-size="9" fill="#6b7280"') : ''));
}

export function rightTriangle(a, b, { label = '?' } = {}) {
  const W = 260, H = 190, k = Math.min(150 / b, 110 / a), x0 = 50, y0 = 150, bw = b * k, ah = a * k;
  return wrap(W, H, `<polygon points="${x0},${y0} ${x0 + bw},${y0} ${x0},${y0 - ah}" fill="#dcfce7" stroke="${INK}" stroke-width="2"/><path d="M${x0} ${y0 - 14} h14 v14" fill="none" stroke="${INK}"/>` +
    text(x0 - 8, y0 - ah / 2, a, 'text-anchor="end"') + text(x0 + bw / 2, y0 + 18, b, 'text-anchor="middle"') + text(x0 + bw / 2 + 8, y0 - ah / 2 - 4, label, 'font-weight="700"'));
}

export function circleFig(r, { show = 'radius' } = {}) {
  const W = 220, H = 180, cx = 110, cy = 90, R = 66;
  const line = show === 'diameter' ? `<line x1="${cx - R}" y1="${cy}" x2="${cx + R}" y2="${cy}" stroke="${INK}" stroke-width="2"/>` + text(cx, cy - 6, `${r * 2}`, 'text-anchor="middle"')
    : `<line x1="${cx}" y1="${cy}" x2="${cx + R}" y2="${cy}" stroke="${INK}" stroke-width="2"/>` + text(cx + R / 2, cy - 6, `${r}`, 'text-anchor="middle"');
  return wrap(W, H, `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#fef3c7" stroke="${INK}" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="3" fill="${INK}"/>${line}`);
}

export function coordPlane(points, { range = 6 } = {}) { // points: [{x,y,label}]
  const W = 240, H = 240, c = 120, u = 100 / range; let s = '';
  for (let i = -range; i <= range; i++) {
    s += `<line x1="${c + i * u}" y1="${c - range * u}" x2="${c + i * u}" y2="${c + range * u}" stroke="${GRID}"/><line x1="${c - range * u}" y1="${c + i * u}" x2="${c + range * u}" y2="${c + i * u}" stroke="${GRID}"/>`;
    if (i && i % 2 === 0) s += text(c + i * u, c + 13, i, 'text-anchor="middle" font-size="9"') + text(c - 5, c - i * u + 3, i, 'text-anchor="end" font-size="9"');
  }
  s += `<line x1="${c - range * u - 6}" y1="${c}" x2="${c + range * u + 6}" y2="${c}" stroke="${INK}" stroke-width="1.5"/><line x1="${c}" y1="${c - range * u - 6}" x2="${c}" y2="${c + range * u + 6}" stroke="${INK}" stroke-width="1.5"/>`;
  for (const p of points) s += `<circle cx="${c + p.x * u}" cy="${c - p.y * u}" r="4.5" fill="#ef4444"/>` + text(c + p.x * u + 7, c - p.y * u - 6, p.label, 'font-weight="700" font-size="13"');
  return wrap(W, H, s);
}

export function angleFig(deg) { // straight line with a ray: one angle labelled, other "x"
  const W = 260, H = 130, cx = 130, cy = 100, R = 100, a = (deg * Math.PI) / 180;
  return wrap(W, H, `<line x1="${cx - R}" y1="${cy}" x2="${cx + R}" y2="${cy}" stroke="${INK}" stroke-width="2"/><line x1="${cx}" y1="${cy}" x2="${(cx + R * 0.9 * Math.cos(a)).toFixed(1)}" y2="${(cy - R * 0.9 * Math.sin(a)).toFixed(1)}" stroke="${INK}" stroke-width="2"/>` +
    text(cx + 18, cy - 8, `${deg}°`, 'font-weight="700"') + text(cx - 38, cy - 8, 'x°', 'font-weight="700"'));
}

export function numberLine(min, max, mark, label = 'P') {
  const W = 320, H = 80, L = 20, R = 300, x = (v) => L + ((v - min) / (max - min)) * (R - L); let s = `<line x1="${L}" y1="40" x2="${R}" y2="40" stroke="${INK}" stroke-width="2"/>`;
  for (let v = min; v <= max; v++) s += `<line x1="${x(v)}" y1="34" x2="${x(v)}" y2="46" stroke="${INK}"/>` + text(x(v), 62, v, 'text-anchor="middle" font-size="11"');
  return wrap(W, H, s + `<circle cx="${x(mark)}" cy="40" r="5" fill="#ef4444"/>` + text(x(mark), 26, label, 'text-anchor="middle" font-weight="700"'));
}

export function gridShape(cells, { n = 6 } = {}) { // cells: [[col,row]] shaded unit squares
  const u = 24, W = n * u + 20, H = n * u + 20; let s = '';
  for (const [c, r] of cells) s += `<rect x="${10 + c * u}" y="${10 + r * u}" width="${u}" height="${u}" fill="#a5b4fc"/>`;
  for (let i = 0; i <= n; i++) s += `<line x1="${10 + i * u}" y1="10" x2="${10 + i * u}" y2="${10 + n * u}" stroke="#9ca3af"/><line x1="10" y1="${10 + i * u}" x2="${10 + n * u}" y2="${10 + i * u}" stroke="#9ca3af"/>`;
  return wrap(W, H, s);
}

/* ===================== round 2: more graph / figure types ===================== */
export function scatterPlot({ title, points, xMax = 10, yMax = 10, step = 2, line = null, xLabel = 'x', yLabel = 'y' }) {
  const W = 340, H = 250, L = 44, R = 14, T = 32, B = 208, X = (v) => L + ((W - L - R) * v) / xMax, Y = (v) => B - ((B - T) * v) / yMax;
  let s = text(W / 2, 18, title, 'text-anchor="middle" font-weight="700" font-size="13"');
  for (let v = 0; v <= yMax; v += step) s += `<line x1="${L}" y1="${Y(v)}" x2="${W - R}" y2="${Y(v)}" stroke="${GRID}"/>` + text(L - 6, Y(v) + 4, v, 'text-anchor="end" font-size="10"');
  for (let v = 0; v <= xMax; v += step) s += `<line x1="${X(v)}" y1="${T}" x2="${X(v)}" y2="${B}" stroke="${GRID}"/>` + text(X(v), B + 14, v, 'text-anchor="middle" font-size="10"');
  s += `<line x1="${L}" y1="${T}" x2="${L}" y2="${B}" stroke="${INK}"/><line x1="${L}" y1="${B}" x2="${W - R}" y2="${B}" stroke="${INK}"/>` + text(W / 2, H - 6, xLabel, 'text-anchor="middle" font-size="11"') + text(12, (T + B) / 2, yLabel, `text-anchor="middle" font-size="11" transform="rotate(-90 12 ${(T + B) / 2})"`);
  if (line) s += `<line x1="${X(0)}" y1="${Y(line.b)}" x2="${X(xMax)}" y2="${Y(Math.min(yMax, line.m * xMax + line.b))}" stroke="#ef4444" stroke-width="2"/>`;
  for (const [x, y] of points) s += `<circle cx="${X(x)}" cy="${Y(y)}" r="4" fill="${COLORS[0]}"/>`;
  return wrap(W, H, s);
}

export function groupedBar({ title, labels, series, yMax, yStep, yLabel }) {
  const W = 360, H = 240, L = 46, R = 12, T = 44, B = 198, n = labels.length, slot = (W - L - R) / n, bw = Math.min(22, slot / (series.length + 1));
  let s = text(W / 2, 16, title, 'text-anchor="middle" font-weight="700" font-size="13"') + axes({ W, H, L, B, T, R, yMax, yStep, yLabel });
  series.forEach((se, k) => { s += `<rect x="${W / 2 - 70 + k * 74}" y="24" width="10" height="10" fill="${COLORS[k * 3 % 6]}"/>` + text(W / 2 - 56 + k * 74, 33, se.name, 'font-size="11"'); });
  labels.forEach((lab, i) => {
    const x0 = L + slot * i + (slot - bw * series.length) / 2;
    series.forEach((se, k) => { const h = ((B - T) * se.values[i]) / yMax; s += `<rect x="${x0 + k * bw}" y="${B - h}" width="${bw}" height="${h}" fill="${COLORS[k * 3 % 6]}"/>`; });
    s += text(L + slot * i + slot / 2, B + 15, lab, 'text-anchor="middle" font-size="11"');
  });
  return wrap(W, H, s);
}

export function histogram({ title, bins, values, yMax, yStep, xLabel = '', yLabel = 'Students' }) {
  const W = 360, H = 240, L = 46, R = 12, T = 34, B = 196, n = bins.length, bw = (W - L - R) / n;
  let s = text(W / 2, 18, title, 'text-anchor="middle" font-weight="700" font-size="13"') + axes({ W, H, L, B, T, R, yMax, yStep, yLabel });
  values.forEach((v, i) => { const h = ((B - T) * v) / yMax; s += `<rect x="${L + bw * i}" y="${B - h}" width="${bw}" height="${h}" fill="${COLORS[1]}" stroke="#fff"/>` + text(L + bw * i + bw / 2, B + 15, bins[i], 'text-anchor="middle" font-size="10"'); });
  return wrap(W, H, s + (xLabel ? text(W / 2, H - 4, xLabel, 'text-anchor="middle" font-size="11"') : ''));
}

export function pictograph({ title, rows, unit }) { // rows: [{label,count}] ; each star = unit
  const star = (cx, cy) => { const p = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 4.2 : 9, a = (Math.PI / 5) * i - Math.PI / 2; p.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`); } return `<polygon points="${p.join(' ')}" fill="#f59e0b" stroke="#b45309" stroke-width=".8"/>`; };
  const W = 340, H = 60 + rows.length * 30; let s = text(W / 2, 18, title, 'text-anchor="middle" font-weight="700" font-size="13"') + text(W - 12, H - 8, `Each ★ = ${unit}`, 'text-anchor="end" font-size="11" fill="#6b7280"');
  rows.forEach((r, i) => { const y = 48 + i * 30; s += text(12, y + 4, r.label, 'font-size="12"'); for (let k = 0; k < r.count; k++) s += star(100 + k * 22, y); });
  return wrap(W, H, s);
}

export function venn({ title, aLabel, bLabel, onlyA, both, onlyB, outside }) {
  const W = 320, H = 200;
  return wrap(W, H, text(W / 2, 16, title, 'text-anchor="middle" font-weight="700" font-size="13"') + `<rect x="10" y="26" width="300" height="164" fill="none" stroke="${INK}"/>` +
    `<circle cx="125" cy="110" r="58" fill="#4f46e5" fill-opacity=".25" stroke="${INK}"/><circle cx="195" cy="110" r="58" fill="#10b981" fill-opacity=".25" stroke="${INK}"/>` +
    text(100, 50, aLabel, 'text-anchor="middle" font-size="12" font-weight="700"') + text(220, 50, bLabel, 'text-anchor="middle" font-size="12" font-weight="700"') +
    text(100, 114, onlyA, 'text-anchor="middle" font-size="16"') + text(160, 114, both, 'text-anchor="middle" font-size="16"') + text(220, 114, onlyB, 'text-anchor="middle" font-size="16"') +
    (outside != null ? text(290, 178, outside, 'text-anchor="end" font-size="13"') : ''));
}

export function clockFace(h, m) {
  const W = 200, H = 200, c = 100, R = 86; let s = `<circle cx="${c}" cy="${c}" r="${R}" fill="#fff" stroke="${INK}" stroke-width="3"/>`;
  for (let i = 1; i <= 12; i++) { const a = (i * Math.PI) / 6 - Math.PI / 2; s += text((c + (R - 16) * Math.cos(a)).toFixed(1), (c + (R - 16) * Math.sin(a) + 5).toFixed(1), i, 'text-anchor="middle" font-size="14" font-weight="700"'); }
  for (let i = 0; i < 60; i++) { const a = (i * Math.PI) / 30, r1 = i % 5 ? R - 5 : R - 9; s += `<line x1="${(c + r1 * Math.cos(a)).toFixed(1)}" y1="${(c + r1 * Math.sin(a)).toFixed(1)}" x2="${(c + R * Math.cos(a)).toFixed(1)}" y2="${(c + R * Math.sin(a)).toFixed(1)}" stroke="${INK}"/>`; }
  const ha = ((h % 12) + m / 60) * (Math.PI / 6) - Math.PI / 2, ma = m * (Math.PI / 30) - Math.PI / 2;
  s += `<line x1="${c}" y1="${c}" x2="${(c + 46 * Math.cos(ha)).toFixed(1)}" y2="${(c + 46 * Math.sin(ha)).toFixed(1)}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><line x1="${c}" y1="${c}" x2="${(c + 68 * Math.cos(ma)).toFixed(1)}" y2="${(c + 68 * Math.sin(ma)).toFixed(1)}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><circle cx="${c}" cy="${c}" r="4" fill="${INK}"/>`;
  return wrap(W, H, s);
}

export function fractionShade(total, shaded, shape = 'bar') {
  if (shape === 'circle') {
    const W = 180, H = 180, cx = 90, cy = 90, r = 70; let s = '';
    for (let i = 0; i < total; i++) {
      const a0 = (i * 2 * Math.PI) / total - Math.PI / 2, a1 = ((i + 1) * 2 * Math.PI) / total - Math.PI / 2;
      s += `<path d="M${cx} ${cy} L${(cx + r * Math.cos(a0)).toFixed(1)} ${(cy + r * Math.sin(a0)).toFixed(1)} A${r} ${r} 0 0 1 ${(cx + r * Math.cos(a1)).toFixed(1)} ${(cy + r * Math.sin(a1)).toFixed(1)} Z" fill="${i < shaded ? '#a5b4fc' : '#fff'}" stroke="${INK}" stroke-width="1.5"/>`;
    }
    return wrap(W, H, s);
  }
  const W = 300, H = 70, w = 280 / total; let s = '';
  for (let i = 0; i < total; i++) s += `<rect x="${10 + i * w}" y="14" width="${w}" height="42" fill="${i < shaded ? '#a5b4fc' : '#fff'}" stroke="${INK}" stroke-width="1.5"/>`;
  return wrap(W, H, s);
}

export function tableSvg({ title, headers, rows, colW = 90 }) {
  const W = 20 + headers.length * colW, rowH = 26, H = 40 + (rows.length + 1) * rowH; let s = text(W / 2, 18, title, 'text-anchor="middle" font-weight="700" font-size="13"');
  const all = [headers, ...rows];
  all.forEach((r, i) => {
    const y = 28 + i * rowH; s += `<rect x="10" y="${y}" width="${W - 20}" height="${rowH}" fill="${i === 0 ? '#e5e7eb' : i % 2 ? '#fff' : '#f9fafb'}" stroke="${GRID}"/>`;
    r.forEach((c, k) => { s += text(10 + k * colW + colW / 2, y + 17, c, `text-anchor="middle" font-size="12" ${i === 0 ? 'font-weight="700"' : ''}`); });
  });
  return wrap(W, H, s);
}

export function reflectGrid(points, { range = 6 } = {}) { // points [{x,y,label}] joined as a polygon
  const base = coordPlane(points, { range }), u = 100 / range, c = 120;
  const poly = `<polygon points="${points.map((p) => `${c + p.x * u},${c - p.y * u}`).join(' ')}" fill="#a5b4fc" fill-opacity=".45" stroke="${INK}" stroke-width="1.5"/>`;
  return base.replace(/<circle/, poly + '<circle');
}
