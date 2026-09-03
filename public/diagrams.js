// Renders animated sequence diagrams as inline SVG. Steps appear one after another with a
// travelling dot, then the whole sequence loops. Uses SVG's own timing (SMIL), no scripts.
import { esc } from '/app.js';

const COLORS = { request: '#8fd0ff', response: '#5fcf98', event: '#f2b04b', error: '#f07c7c' };
const TEXT = '#f4f8fb', MUTED = '#9fbdd3', LINE = '#1b5a80', NODE = '#003a5c';

export function renderDiagram(d, { compact = false } = {}) {
  if (!d || d.type !== 'sequence') return '';
  const n = d.nodes.length;
  const W = compact ? 420 : 800;
  const font = compact ? 11.5 : 13;
  const nodeFont = compact ? 12 : 14;
  const colW = W / n;
  const x = (i) => colW * (i + 0.5);
  const nodeW = Math.min(colW - 12, compact ? 120 : 190);
  const nodeH = 40;
  const top = 12;
  const lineTop = top + nodeH + 6;
  const rowH = compact ? 60 : 54;
  const step0 = lineTop + 34;
  const charW = font * 0.56;
  const stepGap = 1.15, lead = 0.5, hold = 2.6;
  const T = lead + d.steps.length * stepGap + hold;
  const H = step0 + d.steps.length * rowH + 4;

  const wrap = (text, maxPx, maxLines = 3) => {
    const maxChars = Math.max(8, Math.floor(maxPx / charW));
    const words = String(text).split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/.{2}$/, '…'); }
    return lines;
  };

  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(d.caption || 'Sequence diagram')}">
  <style>text{font-family:"Public Sans","Segoe UI",system-ui,sans-serif}</style>
  <rect id="dq-loop" width="0" height="0"><animate id="dqLoop" attributeName="opacity" from="1" to="1" dur="${T}s" repeatCount="indefinite"></animate></rect>`;

  // Lifelines and node headers
  d.nodes.forEach((nd, i) => {
    out += `<line x1="${x(i)}" y1="${lineTop}" x2="${x(i)}" y2="${H - 4}" stroke="${LINE}" stroke-width="1.5" stroke-dasharray="4 4"></line>
    <rect x="${x(i) - nodeW / 2}" y="${top}" width="${nodeW}" height="${nodeH}" rx="8" fill="${NODE}" stroke="${LINE}"></rect>
    <text x="${x(i)}" y="${top + (nd.sub ? 18 : 25)}" text-anchor="middle" font-size="${nodeFont}" font-weight="700" fill="${TEXT}">${esc(nd.label)}</text>
    ${nd.sub ? `<text x="${x(i)}" y="${top + 32}" text-anchor="middle" font-size="${nodeFont - 3}" fill="${MUTED}">${esc(nd.sub)}</text>` : ''}`;
  });

  d.steps.forEach((s, k) => {
    const y = step0 + k * rowH;
    const color = COLORS[s.kind] || COLORS.request;
    const D = (lead + k * stepGap).toFixed(2);
    const begin = `dqLoop.begin+${D}s; dqLoop.repeatEvent+${D}s`;
    const dur = (T - Number(D)).toFixed(2);
    out += `<g opacity="0"><set attributeName="opacity" to="1" begin="${begin}" dur="${dur}s" fill="remove"></set>`;
    if (s.from === s.to) {
      const bw = Math.min(colW - 10, compact ? 200 : 300);
      const lines = wrap(s.label, bw - 16, 2);
      const bh = 12 + lines.length * (font + 3);
      out += `<rect x="${x(s.from) - bw / 2}" y="${y - bh / 2}" width="${bw}" height="${bh}" rx="7" fill="${NODE}" stroke="${color}" stroke-dasharray="3 3"></rect>`;
      lines.forEach((ln, li) => { out += `<text x="${x(s.from)}" y="${y - bh / 2 + 9 + (li + 1) * (font + 3) - 3}" text-anchor="middle" font-size="${font}" fill="${TEXT}">${esc(ln)}</text>`; });
    } else {
      const x1 = x(s.from), x2 = x(s.to);
      const dir = x2 > x1 ? 1 : -1;
      const ex = x2 - dir * 10;
      const L = Math.abs(ex - x1);
      const lines = wrap(s.label, Math.abs(x2 - x1) - 24, 2);
      out += `<line x1="${x1}" y1="${y}" x2="${ex}" y2="${y}" stroke="${color}" stroke-width="2" stroke-dasharray="${L}" stroke-dashoffset="${L}"><animate attributeName="stroke-dashoffset" from="${L}" to="0" dur="0.45s" begin="${begin}" fill="freeze"></animate></line>
      <polygon points="${x2},${y} ${x2 - dir * 11},${y - 5.5} ${x2 - dir * 11},${y + 5.5}" fill="${color}"></polygon>
      <circle r="4.5" fill="${color}"><animateMotion path="M ${x1} ${y} L ${ex} ${y}" dur="0.45s" begin="${begin}" fill="freeze"></animateMotion></circle>`;
      lines.forEach((ln, li) => { out += `<text x="${(x1 + x2) / 2}" y="${y - 7 - (lines.length - 1 - li) * (font + 2)}" text-anchor="middle" font-size="${font}" fill="${TEXT}">${esc(ln)}</text>`; });
    }
    out += '</g>';
  });
  out += '</svg>';
  return `<div class="diagram">${out}${d.caption ? `<div class="cap">${esc(d.caption)}</div>` : ''}</div>`;
}
