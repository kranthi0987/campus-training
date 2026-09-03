// Certificate of completion as a self-contained SVG (A4 landscape at 96 dpi).
const BRAND = '#00446a';
export const PROGRAMME = 'Campus Training';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Safe, readable download name: "certificate-grace-hopper-python.svg". */
export function certificateFilename(c, ext = 'svg') {
  const slug = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return ['certificate', slug(c.name), slug(c.sessionTitle)].filter(Boolean).join('-') + '.' + ext;
}

function longDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function certificateSvg(c) {
  const W = 1123, H = 794;
  const title = c.sessionTitle.length > 44 ? c.sessionTitle.slice(0, 42) + '…' : c.sessionTitle;
  const nameSize = c.name.length > 22 ? 56 : 72;
  const trainers = c.trainers.slice(0, 3);
  const sigW = 240, gap = 40;
  const sigStart = (W - (trainers.length * sigW + (trainers.length - 1) * gap)) / 2;
  const stripes = Array.from({ length: Math.floor((W - 120 + 22) / 44) }, (_, i) => `<rect x="${i * 44}" y="0" width="22" height="14" fill="${i % 2 ? '#5fb2ea' : BRAND}"></rect>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'Bricolage Grotesque','Public Sans','Segoe UI',Arial,sans-serif">
  <rect width="${W}" height="${H}" fill="#ffffff"></rect>
  <rect x="24" y="24" width="${W - 48}" height="${H - 48}" fill="none" stroke="${BRAND}" stroke-width="3"></rect>
  <rect x="34" y="34" width="${W - 68}" height="${H - 68}" fill="none" stroke="#dde3ea" stroke-width="1"></rect>
  <g transform="translate(60 48)">${stripes}</g>
  <text x="${W / 2}" y="132" text-anchor="middle" font-size="26" font-weight="800" fill="#12263a" letter-spacing="-0.5">${esc(PROGRAMME)}</text>
  <text x="${W / 2}" y="230" text-anchor="middle" font-size="14" letter-spacing="5" fill="${BRAND}" font-weight="700">CERTIFICATE OF COMPLETION</text>
  <text x="${W / 2}" y="272" text-anchor="middle" font-size="16" fill="#55677a">This certifies that</text>
  <text x="${W / 2}" y="${272 + nameSize + 8}" text-anchor="middle" font-size="${nameSize}" font-weight="800" fill="#12263a" letter-spacing="-1">${esc(c.name)}</text>
  <line x1="${W / 2 - 220}" y1="${272 + nameSize + 30}" x2="${W / 2 + 220}" y2="${272 + nameSize + 30}" stroke="#5fb2ea" stroke-width="3"></line>
  <text x="${W / 2}" y="${272 + nameSize + 66}" text-anchor="middle" font-size="16" fill="#55677a">completed the training session</text>
  <text x="${W / 2}" y="${272 + nameSize + 108}" text-anchor="middle" font-size="30" font-weight="700" fill="#12263a">${esc(title)}</text>
  <text x="${W / 2}" y="${272 + nameSize + 138}" text-anchor="middle" font-size="15" fill="#55677a">${esc(c.module ? c.module + ' · ' : '')}${esc(longDate(c.date))}</text>
  <g transform="translate(${W / 2 - 270} ${272 + nameSize + 170})">
    <rect width="540" height="64" rx="12" fill="#f3f5f7"></rect>
    <text x="90" y="26" text-anchor="middle" font-size="24" font-weight="800" fill="#12263a">${c.score}</text>
    <text x="90" y="46" text-anchor="middle" font-size="11" letter-spacing="1.5" fill="#55677a">POINTS</text>
    <text x="270" y="26" text-anchor="middle" font-size="24" font-weight="800" fill="#12263a">${c.correct} / ${c.questionCount}</text>
    <text x="270" y="46" text-anchor="middle" font-size="11" letter-spacing="1.5" fill="#55677a">CORRECT</text>
    <text x="450" y="26" text-anchor="middle" font-size="24" font-weight="800" fill="#12263a">${c.rank} of ${c.participants}</text>
    <text x="450" y="46" text-anchor="middle" font-size="11" letter-spacing="1.5" fill="#55677a">RANK</text>
  </g>
  ${trainers.map((t, i) => `<g transform="translate(${sigStart + i * (sigW + gap)} ${H - 130})">
    <line x1="0" y1="0" x2="${sigW}" y2="0" stroke="#12263a" stroke-width="1"></line>
    <text x="${sigW / 2}" y="22" text-anchor="middle" font-size="14" font-weight="700" fill="#12263a">${esc(t)}</text>
    <text x="${sigW / 2}" y="40" text-anchor="middle" font-size="11" letter-spacing="1.5" fill="#55677a">TRAINER</text>
  </g>`).join('')}
  <text x="${W / 2}" y="${H - 52}" text-anchor="middle" font-size="11" fill="#8797a8">Issued ${esc(c.issuedOn)} · ${esc(c.email)}</text>
</svg>`;
}
