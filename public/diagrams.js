// Animated diagrams for slides, rendered as inline SVG. Every diagram plays its steps one after
// another and then loops, using SVG's own timing (SMIL), so no script runs on the projector or
// the interns' phones. `compact` is the phone layout.
//
// Types (the `type` field of a slide's diagram):
//   sequence  lifelines left to right, arrows play in order (a step whose from === to is a note)
//   flow      boxes in a row (two rows from six boxes, a column on the phone) with a packet
//             travelling along each edge; an edge that is not "next box" is drawn as an arc
//   log       Kafka-style partitions filling up, then a consumer bookmark moving along one
//   token     a JWT bar that decodes part by part into cards
//   timeline  milestones on a line, reached one by one by a travelling dot
import { esc } from '/app.js';

const COLORS = { request: '#8fd0ff', response: '#5fcf98', event: '#f2b04b', error: '#f07c7c', neutral: '#9fbdd3' };
const TEXT = '#f4f8fb', MUTED = '#9fbdd3', LINE = '#1b5a80', NODE = '#003a5c', NODE_ON = '#0a4f7c', AMBER = '#f2b04b';
const FONT = 'font-family:"Public Sans","Segoe UI",system-ui,sans-serif';
const MONO = 'font-family:Consolas,"Cascadia Mono",ui-monospace,monospace';

export function renderDiagram(d, { compact = false } = {}) {
  const draw = d && RENDER[d.type];
  if (!draw) return '';
  const { body, W, H } = draw(d, compact);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(d.caption || 'Diagram')}"><style>text{${FONT}}text.mono{${MONO}}</style>${body}</svg>`;
  return `<div class="diagram ${d.type}">${svg}${d.caption ? `<div class="cap">${esc(d.caption)}</div>` : ''}</div>`;
}

// ---- shared pieces ------------------------------------------------------------------------
const f2 = (n) => Number(n).toFixed(2);
/** The invisible clock every step hangs off: restarts all `at(t)` timings every T seconds. */
const clock = (T) => `<rect id="dq-loop" width="0" height="0"><animate id="dqLoop" attributeName="opacity" from="1" to="1" dur="${f2(T)}s" repeatCount="indefinite"/></rect>`;
const at = (t) => `dqLoop.begin+${f2(t)}s; dqLoop.repeatEvent+${f2(t)}s`;
/** Opens a group that is invisible until t and stays visible until the loop restarts. */
const from = (t, T) => `<g opacity="0"><set attributeName="opacity" to="1" begin="${at(t)}" dur="${f2(T - t)}s" fill="remove"/>`;
const setAt = (attr, to, t, T) => `<set attributeName="${attr}" to="${to}" begin="${at(t)}" dur="${f2(T - t)}s" fill="remove"/>`;
const color = (kind) => COLORS[kind] || COLORS.request;

/** Word wrap to a pixel width; the last line gets an ellipsis when there are too many. */
function wrap(text, maxPx, font, maxLines = 3) {
  const maxChars = Math.max(6, Math.floor(maxPx / (font * 0.56)));
  const lines = [];
  let cur = '';
  for (const w of String(text ?? '').split(' ')) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/.{2}$/, '…'); }
  return lines;
}
/** Character clip for text without spaces (base64, code) in a monospace face. */
function clip(text, maxPx, font) {
  const s = String(text ?? ''), max = Math.max(4, Math.floor(maxPx / (font * 0.6)));
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
/** Lines of text stacked from y downwards (or ending at y with up: true). */
function lines(arr, x, y, font, { anchor = 'middle', fill = TEXT, weight = 400, mono = false, up = false } = {}) {
  const lh = font + 3;
  return arr.map((ln, i) => `<text x="${f2(x)}" y="${f2(up ? y - (arr.length - 1 - i) * lh : y + i * lh)}" text-anchor="${anchor}" font-size="${font}" font-weight="${weight}" fill="${fill}"${mono ? ' class="mono"' : ''}>${esc(ln)}</text>`).join('');
}
/** Arrow head with its tip at (x, y); angle 0 points right, 90 points down. */
const head = (x, y, angle, c) => `<polygon points="0,0 -11,-5.5 -11,5.5" transform="translate(${f2(x)} ${f2(y)}) rotate(${angle})" fill="${c}"/>`;
/** A stroke that draws itself from t, with a dot travelling along it. */
const travel = (path, len, c, t, dur = 0.45) => `<path d="${path}" stroke="${c}" stroke-width="2" fill="none" stroke-dasharray="${f2(len)}" stroke-dashoffset="${f2(len)}"><animate attributeName="stroke-dashoffset" from="${f2(len)}" to="0" dur="${dur}s" begin="${at(t)}" fill="freeze"/></path><circle r="4.5" fill="${c}"><animateMotion path="${path}" dur="${dur}s" begin="${at(t)}" fill="freeze"/></circle>`;
const quad = (p0, p1, p2) => ({ path: `M ${f2(p0[0])} ${f2(p0[1])} Q ${f2(p1[0])} ${f2(p1[1])} ${f2(p2[0])} ${f2(p2[1])}`, len: quadLen(p0, p1, p2), mid: [(p0[0] + 2 * p1[0] + p2[0]) / 4, (p0[1] + 2 * p1[1] + p2[1]) / 4] });
const quadLen = (p0, p1, p2) => { let L = 0, prev = p0; for (let i = 1; i <= 24; i++) { const s = i / 24, u = 1 - s; const p = [u * u * p0[0] + 2 * u * s * p1[0] + s * s * p2[0], u * u * p0[1] + 2 * u * s * p1[1] + s * s * p2[1]]; L += Math.hypot(p[0] - prev[0], p[1] - prev[1]); prev = p; } return L; };
const box = (x, y, w, h, c = LINE, fill = NODE) => `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" rx="8" fill="${fill}" stroke="${c}"`;
/** A short label on a dark backing, for text that sits on top of a line. */
function tag(ls, x, y, font, c, anchor = 'middle') {
  const lw = Math.max(...ls.map((l) => l.length)) * font * 0.56 + 14, lh = ls.length * (font + 3) + 8;
  const left = anchor === 'middle' ? x - lw / 2 : anchor === 'end' ? x - lw + 6 : x - 6;
  return `<rect x="${f2(left)}" y="${f2(y - lh / 2)}" width="${f2(lw)}" height="${f2(lh)}" rx="5" fill="${NODE}" stroke="${c}" stroke-dasharray="3 3"/>` + lines(ls, x, y - lh / 2 + font + 1, font, { anchor });
}

// ---- sequence -----------------------------------------------------------------------------
function sequence(d, compact) {
  const n = d.nodes.length;
  const W = compact ? 420 : 800;
  const font = compact ? 11.5 : 13, nodeFont = compact ? 12 : 14;
  const colW = W / n, x = (i) => colW * (i + 0.5);
  const nodeW = Math.min(colW - 12, compact ? 120 : 190), nodeH = 40, top = 12;
  const lineTop = top + nodeH + 6, rowH = compact ? 60 : 54, step0 = lineTop + 34;
  const gap = 1.15, lead = 0.5, hold = 2.6;
  const T = lead + d.steps.length * gap + hold;
  const H = step0 + d.steps.length * rowH + 4;
  let out = clock(T);
  d.nodes.forEach((nd, i) => {
    out += `<line x1="${f2(x(i))}" y1="${lineTop}" x2="${f2(x(i))}" y2="${H - 4}" stroke="${LINE}" stroke-width="1.5" stroke-dasharray="4 4"/>${box(x(i) - nodeW / 2, top, nodeW, nodeH)}/>`
      + lines([nd.label], x(i), top + (nd.sub ? 18 : 25), nodeFont, { weight: 700 })
      + (nd.sub ? lines([nd.sub], x(i), top + 32, nodeFont - 3, { fill: MUTED }) : '');
  });
  d.steps.forEach((s, k) => {
    const y = step0 + k * rowH, c = color(s.kind), t = lead + k * gap;
    out += from(t, T);
    if (s.from === s.to) {
      const bw = Math.min(colW - 10, compact ? 200 : 300);
      const ls = wrap(s.label, bw - 16, font, 2);
      const bh = 12 + ls.length * (font + 3);
      out += `${box(x(s.from) - bw / 2, y - bh / 2, bw, bh, c)} stroke-dasharray="3 3"/>` + lines(ls, x(s.from), y - bh / 2 + font + 5, font);
    } else {
      const x1 = x(s.from), x2 = x(s.to), dir = x2 > x1 ? 1 : -1, ex = x2 - dir * 10;
      const ls = wrap(s.label, Math.abs(x2 - x1) - 24, font, 2);
      out += travel(`M ${f2(x1)} ${y} L ${f2(ex)} ${y}`, Math.abs(ex - x1), c, t) + head(x2, y, dir > 0 ? 0 : 180, c)
        + lines(ls, (x1 + x2) / 2, y - 7, font, { up: true });
    }
    out += '</g>';
  });
  return { body: out, W, H };
}

// ---- flow -----------------------------------------------------------------------------------
function flow(d, compact) {
  const n = d.nodes.length;
  const edges = d.edges || d.nodes.slice(1).map((_, i) => ({ from: i, to: i + 1, label: '' }));
  const vertical = compact && n > 3;
  const rows = !compact && n >= 6 ? 2 : 1;
  const perRow = vertical ? 1 : Math.ceil(n / rows);
  const row = (i) => (vertical ? i : Math.floor(i / perRow)), col = (i) => (vertical ? 0 : i % perRow);
  const W = compact ? 420 : 720;
  const font = compact ? 11 : 13.5, nodeFont = compact ? 12 : 14, subFont = nodeFont - 3;
  const gap = 1.25, lead = 0.5, hold = 2.6;
  const T = lead + edges.length * gap + hold;
  const next = (e) => e.to === e.from + 1;
  const straight = (e) => next(e) && (vertical || row(e.from) === row(e.to));
  const rowBreak = (e) => next(e) && !straight(e);
  const arcs = edges.filter((e) => !next(e));
  const sideArc = !vertical && arcs.some((e) => row(e.from) !== row(e.to));
  const belowArc = !vertical && arcs.some((e) => row(e.from) === row(e.to));
  // Node size: every box gets the same height, enough for the longest label and sub.
  const M = sideArc ? 96 : 0;
  const colW = (W - 2 * M) / perRow;
  const nodeW = vertical ? 168 : Math.min(colW - 30, 190);
  const titles = d.nodes.map((nd) => wrap(nd.label, nodeW - 14, nodeFont, 2));
  const subs = d.nodes.map((nd) => (nd.sub ? wrap(nd.sub, nodeW - 14, subFont, 2) : []));
  const tl = Math.max(...titles.map((t) => t.length)), sl = Math.max(...subs.map((s) => s.length));
  const nodeH = 14 + tl * (nodeFont + 3) + (sl ? 4 + sl * (subFont + 3) : 0);
  const band = vertical ? 0 : 2 * (font + 3) + 10;          // edge labels sit above each row
  const rowGap = vertical ? 46 : band + 30;
  const cx = (i) => (vertical ? 12 + nodeW / 2 : M + colW * (col(i) + 0.5));
  const cy = (i) => (vertical ? 10 : band) + nodeH / 2 + row(i) * (nodeH + rowGap);
  const H = vertical ? 20 + n * nodeH + (n - 1) * rowGap : band + rows * nodeH + (rows - 1) * rowGap + (belowArc ? 44 + 8 + 2 * (font + 3) + 12 : 10);
  let out = clock(T);
  // Every edge lights up the node it leaves and, when the packet lands, the node it reaches.
  const lit = new Map();
  edges.forEach((e, k) => { const t = lead + k * gap; if (!lit.has(e.from)) lit.set(e.from, [t, e.kind]); if (!lit.has(e.to)) lit.set(e.to, [t + 0.45, e.kind]); });
  d.nodes.forEach((nd, i) => {
    const on = lit.get(i);
    const textH = titles[i].length * (nodeFont + 3) + (subs[i].length ? 4 + subs[i].length * (subFont + 3) : 0);
    const top = cy(i) - textH / 2;
    out += `<rect x="${f2(cx(i) - nodeW / 2)}" y="${f2(cy(i) - nodeH / 2)}" width="${nodeW}" height="${f2(nodeH)}" rx="9" fill="${NODE}" stroke="${LINE}" stroke-width="1.5">`
      + (on ? setAt('stroke', color(on[1]), on[0], T) + setAt('stroke-width', 2.5, on[0], T) + setAt('fill', NODE_ON, on[0], T) : '') + '</rect>'
      + lines(titles[i], cx(i), top + nodeFont, nodeFont, { weight: 700 })
      + (subs[i].length ? lines(subs[i], cx(i), top + titles[i].length * (nodeFont + 3) + 4 + subFont, subFont, { fill: MUTED }) : '');
  });
  edges.forEach((e, k) => {
    const t = lead + k * gap, c = color(e.kind);
    out += from(t, T);
    if (vertical) {
      const tx = 12 + nodeW + 16;
      if (straight(e)) {
        const x = cx(e.from), y1 = cy(e.from) + nodeH / 2, y2 = cy(e.to) - nodeH / 2;
        const ls = wrap(e.label, W - tx - 8, font, 2);
        out += travel(`M ${f2(x)} ${f2(y1)} L ${f2(x)} ${f2(y2 - 10)}`, y2 - 10 - y1, c, t) + head(x, y2, 90, c)
          + lines(ls, tx, (y1 + y2) / 2 + 4 - (ls.length - 1) * (font + 3) / 2, font, { anchor: 'start' });
      } else {
        const x0 = 12 + nodeW;
        const q = quad([x0, cy(e.from)], [W - 16, (cy(e.from) + cy(e.to)) / 2], [x0 + 10, cy(e.to)]);
        out += travel(q.path, q.len, c, t, 0.6) + head(x0 - 2, cy(e.to), 180, c) + tag(wrap(e.label, 150, font, 2), W - 20, q.mid[1], font, c, 'end');
      }
    } else if (straight(e)) {
      const y = cy(e.from), x1 = cx(e.from) + nodeW / 2, x2 = cx(e.to) - nodeW / 2;
      const ls = wrap(e.label, colW - 8, font, 2);
      out += travel(`M ${f2(x1)} ${f2(y)} L ${f2(x2 - 10)} ${f2(y)}`, x2 - 10 - x1, c, t) + head(x2, y, 0, c)
        + lines(ls, (x1 + x2) / 2, y - nodeH / 2 - 10, font, { up: true });
    } else if (rowBreak(e)) {
      // Down from the last box of a row, across, and down into the first box of the next row.
      const x1 = cx(e.from), y1 = cy(e.from) + nodeH / 2, x2 = cx(e.to), y2 = cy(e.to) - nodeH / 2, ym = y1 + 18;
      const path = `M ${f2(x1)} ${f2(y1)} L ${f2(x1)} ${f2(ym)} L ${f2(x2)} ${f2(ym)} L ${f2(x2)} ${f2(y2 - 10)}`;
      out += travel(path, (ym - y1) + Math.abs(x2 - x1) + (y2 - 10 - ym), c, t, 0.7) + head(x2, y2, 90, c)
        + tag(wrap(e.label, Math.abs(x2 - x1) - 40, font, 1), (x1 + x2) / 2, ym, font, c);
    } else if (row(e.from) === row(e.to)) {
      // Same row: an arc under the boxes, label under the arc.
      const y0 = cy(e.from) + nodeH / 2;
      const q = quad([cx(e.from), y0], [(cx(e.from) + cx(e.to)) / 2, y0 + 88], [cx(e.to), y0 + 10]);
      out += travel(q.path, q.len, c, t, 0.7) + head(cx(e.to), y0 + 2, -90, c)
        + lines(wrap(e.label, Math.abs(cx(e.to) - cx(e.from)) - 20, font, 2), q.mid[0], q.mid[1] + font + 6, font);
    } else {
      // Different rows: an arc round the side, backwards on the left, forwards on the right.
      const back = e.to < e.from, s = back ? -1 : 1;
      const ex = (i) => cx(i) + s * nodeW / 2;
      const q = quad([ex(e.from), cy(e.from)], [(back ? Math.min : Math.max)(ex(e.from), ex(e.to)) + s * 90, (cy(e.from) + cy(e.to)) / 2], [ex(e.to) + s * 10, cy(e.to)]);
      out += travel(q.path, q.len, c, t, 0.7) + head(ex(e.to), cy(e.to), back ? 0 : 180, c) + tag(wrap(e.label, 120, font, 3), q.mid[0], q.mid[1], font, c);
    }
    out += '</g>';
  });
  return { body: out, W, H };
}

// ---- log (Kafka partitions) -------------------------------------------------------------------
function log(d, compact) {
  const W = compact ? 420 : 720;
  const font = compact ? 10.5 : 13.5;
  const labelW = compact ? 84 : 132, cell = compact ? 26 : 44, cgap = compact ? 4 : 7;
  const rowH = cell + (compact ? 16 : 24), top = 36;
  const P = d.partitions.length;
  // Records arrive round-robin across partitions, so the rows fill up together.
  const order = [];
  const most = Math.max(...d.partitions.map((p) => p.records.length));
  for (let j = 0; j < most; j++) d.partitions.forEach((p, i) => { if (p.records[j]) order.push([i, j]); });
  const tick = 0.32, lead = 0.6;
  const tAll = lead + order.length * tick;
  const cur = d.cursor;
  const curMax = cur ? d.partitions[cur.partition].records.length - 1 : 0;
  const curAt = cur ? Math.min(cur.at ?? curMax, curMax) : 0;
  const curDur = cur ? 0.45 * Math.max(1, curAt) : 0;
  const T = tAll + 0.5 + curDur + 2.8;
  const H = top + P * rowH + (cur ? 30 : 8);
  const cxOf = (j) => labelW + j * (cell + cgap) + cell / 2;
  let out = clock(T) + lines([d.title || 'topic'], 0, 18, font + 1, { anchor: 'start', weight: 700 });
  d.partitions.forEach((p, i) => {
    const y = top + i * rowH;
    out += lines([p.label], labelW - 12, y + cell / 2 + 4, font, { anchor: 'end', fill: MUTED });
    // Empty slots first, so a partition reads as a fixed row that fills up left to right.
    p.records.forEach((_, j) => { out += `<rect x="${f2(cxOf(j) - cell / 2)}" y="${y}" width="${cell}" height="${cell}" rx="5" fill="none" stroke="${LINE}" stroke-dasharray="3 3"/>`; });
    out += lines(['→ new records append here'], cxOf(p.records.length) - cell / 2 + 4, y + cell / 2 + 4, font - 1.5, { anchor: 'start', fill: MUTED });
  });
  order.forEach(([i, j], k) => {
    const p = d.partitions[i], r = p.records[j], y = top + i * rowH, t = lead + k * tick, c = color(r.kind || 'event');
    out += from(t, T) + `<rect x="${f2(cxOf(j) - cell / 2)}" y="${y}" width="${cell}" height="${cell}" rx="5" fill="${NODE}" stroke="${c}" stroke-width="1.5"><animate attributeName="y" from="${y - 10}" to="${y}" dur="0.3s" begin="${at(t)}" fill="freeze"/></rect>`
      + lines([String(j)], cxOf(j), y + cell / 2 - (r.key ? 2 : -4), font - (r.key ? 1.5 : 0), { weight: 700 })
      + (r.key ? lines([r.key], cxOf(j), y + cell - 5, font - 4, { fill: c }) : '') + '</g>';
  });
  if (cur) {
    const y = top + cur.partition * rowH, t0 = tAll + 0.5;
    const path = `M ${f2(cxOf(0))} ${y - 6} L ${f2(cxOf(curAt))} ${y - 6}`;
    out += from(t0, T) + `<g><polygon points="0,0 -7,-9 7,-9" fill="${AMBER}"/><animateMotion path="${path}" dur="${f2(Math.max(0.1, curDur))}s" begin="${at(t0)}" fill="freeze"/></g>`
      + lines([`▲ ${cur.label} · committed offset ${curAt}`], labelW, H - 8, font, { anchor: 'start', fill: AMBER, weight: 700 }) + '</g>';
  }
  return { body: out, W, H };
}

// ---- token (JWT) --------------------------------------------------------------------------------
function token(d, compact) {
  const W = compact ? 420 : 720;
  const font = compact ? 10.5 : 13, mono = compact ? 10 : 11.5;
  const parts = d.parts, n = parts.length;
  const barY = 10, barH = compact ? 30 : 38;
  const weights = parts.map((p) => p.weight || 1), sumW = weights.reduce((a, b) => a + b, 0);
  const share = (i, total) => total * weights[i] / sumW;
  const segs = []; let sx = 8;
  parts.forEach((_, i) => { const w = share(i, W - 16 - (n - 1) * 14); segs.push([sx, w]); sx += w + 14; });
  const step = 1.5, lead = 0.6;
  const tV = lead + n * step;
  const T = tV + 3.4;
  const maxLines = Math.max(...parts.map((p) => p.lines.length));
  const cardH = 14 + font + 8 + maxLines * (mono + 4) + 8;
  const cardY = barY + barH + (compact ? 30 : 44);
  const cards = []; let cxx = 8;
  parts.forEach((_, i) => { const w = compact ? W - 16 : share(i, W - 16 - (n - 1) * 12); cards.push([compact ? 8 : cxx, compact ? cardY + i * (cardH + 10) : cardY, w]); cxx += w + 12; });
  const H = (compact ? cardY + n * (cardH + 10) : cardY + cardH + 10) + (d.verdict ? 26 : 0);
  let out = clock(T);
  parts.forEach((p, i) => {
    const [x, w] = segs[i], c = color(p.kind), t = lead + i * step;
    out += `<rect x="${f2(x)}" y="${barY}" width="${f2(w)}" height="${barH}" rx="7" fill="${NODE}" stroke="${c}" opacity="0.45">${setAt('opacity', 1, t, T)}${setAt('stroke-width', 2.5, t, T)}</rect>`
      + `<text x="${f2(x + w / 2)}" y="${f2(barY + barH / 2 + mono / 2 - 1)}" text-anchor="middle" font-size="${mono}" fill="${c}" class="mono" opacity="0.55">${setAt('opacity', 1, t, T)}${esc(clip(p.raw, w - 16, mono))}</text>`
      + (i < n - 1 ? lines(['.'], x + w + 7, barY + barH / 2 + 8, font + 8, { fill: MUTED, weight: 700 }) : '');
    const [cx, cy, cw] = cards[i];
    out += from(t, T);
    if (!compact) out += travel(`M ${f2(x + w / 2)} ${barY + barH} L ${f2(cx + cw / 2)} ${f2(cy - 1)}`, Math.hypot(cx + cw / 2 - x - w / 2, cy - barY - barH), c, t, 0.4);
    out += `<rect x="${f2(cx)}" y="${f2(cy)}" width="${f2(cw)}" height="${f2(cardH)}" rx="9" fill="${NODE}" stroke="${c}"><animate attributeName="y" from="${f2(cy + 10)}" to="${f2(cy)}" dur="0.35s" begin="${at(t)}" fill="freeze"/></rect>`
      + lines([p.label], cx + 12, cy + 14 + font - 2, font, { anchor: 'start', weight: 700, fill: c })
      + lines(p.lines.map((l) => clip(l, cw - 24, mono)), cx + 12, cy + 14 + font + 8 + mono, mono, { anchor: 'start', mono: true });
    out += '</g>';
  });
  if (d.verdict) out += from(tV, T) + lines([`✓ ${d.verdict}`], 8, H - 8, font, { anchor: 'start', fill: COLORS.response, weight: 700 }) + '</g>';
  return { body: out, W, H };
}

// ---- timeline -----------------------------------------------------------------------------------
function timeline(d, compact) {
  const items = d.items, n = items.length;
  const font = compact ? 11.5 : 15;
  const lh = font + 5, pause = 1.15, lead = 0.5;
  const T = lead + n * pause + 3.2;
  const runner = (path, t) => `<circle r="5.5" fill="${TEXT}" opacity="0"><set attributeName="opacity" to="1" begin="${at(t)}" dur="${f2(pause - 0.55)}s" fill="remove"/><animateMotion path="${path}" dur="${f2(pause - 0.55)}s" begin="${at(t)}" fill="freeze"/></circle>`;
  let out, W, H;
  if (compact) {
    W = 420;
    const rowH = 3 * lh + 16, lx = 26, tx = 46;
    H = 16 + n * rowH;
    const y = (i) => 22 + i * rowH;
    out = clock(T) + `<line x1="${lx}" y1="${y(0)}" x2="${lx}" y2="${y(n - 1)}" stroke="${LINE}" stroke-width="2"/>`;
    items.forEach((it, i) => {
      const t = lead + i * pause;
      out += from(t, T) + `<circle cx="${lx}" cy="${y(i)}" r="7" fill="${AMBER}" stroke="#002b45" stroke-width="2"/>`
        + lines([it.when], tx, y(i) - 3, font - 2, { anchor: 'start', fill: AMBER, weight: 700 })
        + lines(wrap(it.title, W - tx - 8, font, 1), tx, y(i) + lh - 3, font, { anchor: 'start', weight: 700 })
        + lines(wrap(it.sub, W - tx - 8, font - 1, 1), tx, y(i) + 2 * lh - 3, font - 1, { anchor: 'start', fill: MUTED }) + '</g>';
      if (i < n - 1) out += runner(`M ${lx} ${y(i)} L ${lx} ${y(i + 1)}`, t + 0.55);
    });
  } else {
    W = 720;
    const M = 140, span = (W - 2 * M) / Math.max(1, n - 1), maxW = Math.min(2 * span - 16, 2 * M - 16);
    const block = 10 + 5 * lh, ly = 14 + block;
    H = ly + block + 16;
    const x = (i) => M + i * span;
    out = clock(T) + `<line x1="${f2(x(0))}" y1="${ly}" x2="${f2(x(n - 1))}" y2="${ly}" stroke="${LINE}" stroke-width="2"/>`;
    items.forEach((it, i) => {
      const t = lead + i * pause, above = i % 2 === 0;
      const stack = [[it.when, font - 2, AMBER, 700], ...wrap(it.title, maxW, font + 1, 2).map((l) => [l, font + 1, TEXT, 700]), ...wrap(it.sub, maxW, font - 1, 2).map((l) => [l, font - 1, MUTED, 400])];
      out += from(t, T) + `<circle cx="${f2(x(i))}" cy="${ly}" r="9" fill="${AMBER}" stroke="#002b45" stroke-width="2"><animate attributeName="r" from="0" to="9" dur="0.3s" begin="${at(t)}" fill="freeze"/></circle>`
        + `<line x1="${f2(x(i))}" y1="${ly + (above ? -12 : 12)}" x2="${f2(x(i))}" y2="${ly + (above ? -24 : 24)}" stroke="${LINE}" stroke-width="1.5"/>`;
      stack.forEach(([txt, fs, fill, weight], k) => {
        const yy = above ? ly - 32 - (stack.length - 1 - k) * lh : ly + 32 + fs + k * lh;
        out += lines([txt], x(i), yy, fs, { fill, weight });
      });
      out += '</g>';
      if (i < n - 1) out += runner(`M ${f2(x(i))} ${ly} L ${f2(x(i + 1))} ${ly}`, t + 0.55);
    });
  }
  return { body: out, W, H };
}

const RENDER = { sequence, flow, log, token, timeline };
