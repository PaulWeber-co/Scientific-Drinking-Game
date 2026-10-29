import { COLUMNS, STAGE, foamHeight, innerLift, rimHalfWidth, surfaceAt, wallX } from './glassPhysics';
import type { GlassSim } from './glassPhysics';
import { contourOf, halfWidthAt } from './glassShapes';
import type { GlassProfile } from './glassShapes';

/**
 * Zeichnet das Glas als Foto einer Bar: dunkler Grund, warmes Licht von
 * links oben. Glas ist hier fast nur Licht – Kanten, Glanzstreifen und ein
 * schwerer Boden –, die Flüssigkeit trägt die Farbe.
 *
 * Perspektive leicht von oben: Rand und Oberfläche sind flache Ellipsen.
 * Davon sieht man die Oberfläche als hellere Fläche, auf der sich das Licht
 * spiegelt; die Schwappwellen verformen sie mit.
 */

const INK = {
  outline: 'rgba(255,246,232,0.46)',
  inner: 'rgba(255,255,255,0.16)',
  wall: 'rgba(255,255,255,0.06)',
  base: 'rgba(255,255,255,0.10)',
  shine: 'rgba(255,255,255,0.30)',
  target: '#ff8a1e',
  foam: '#f7eedb',
  foamShade: '#e3d0a6',
  foamTop: '#fffaf0',
};

export interface DrawOptions {
  showTarget: boolean;
  /** Ruhebild ohne Bewegung (Bewegung reduzieren). */
  still: boolean;
  /** Sekunden, für kleine Wellen im Bild. */
  time: number;
}

/** Perspektive: so flach wirken Rand und Oberfläche. */
const TILT_VIEW = 0.11;

/** Helligkeit einer Farbe, 0…1. */
function luminance(hex: string): number {
  const v = parseInt(hex.slice(1), 16);
  return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255;
}

function withAlpha(hex: string, alpha: number): string {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${alpha})`;
}

export function drawGlass(ctx: CanvasRenderingContext2D, s: GlassSim, opts: DrawOptions): void {
  const dpr = Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, STAGE.width, STAGE.height);
  const { profile, look } = s;
  const lift = innerLift(profile);
  const Y = (y: number) => -(lift + y);
  const contour = contourOf(profile);
  const rim = rimHalfWidth(profile);
  const fill = s.level + s.pending;
  surfaceHalf = Math.max(1, wallX(s) + 1);

  drawTable(ctx, s, fill);

  ctx.save();
  ctx.translate(STAGE.centerX + s.offset, STAGE.table);
  ctx.rotate(s.tilt);

  if (profile.stem) drawStem(ctx, profile);

  // Hinterer Rand: durch das Glas hindurch zu sehen, also schwach.
  ctx.strokeStyle = 'rgba(255,246,232,0.22)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, Y(profile.height), rim + profile.wall / 2, Math.max(2.5, rim * TILT_VIEW), 0, Math.PI, Math.PI * 2);
  ctx.stroke();

  // --- Inhalt, auf den Innenraum beschnitten.
  ctx.save();
  innerPath(ctx, contour, Y, 0);
  ctx.clip();
  drawLiquid(ctx, s, Y, opts);
  ctx.restore();

  if (look.foam) {
    // Die Krone darf sich über den Rand wölben – Schaum steht.
    ctx.save();
    innerPath(ctx, contour, Y, 12);
    ctx.clip();
    drawFoam(ctx, s, Y, opts);
    ctx.restore();
  }

  if (look.straw) drawStraw(ctx, s, Y);
  drawPour(ctx, s, Y);
  drawWalls(ctx, s, contour, Y);
  if (look.cold) drawCondensation(ctx, s, Y);
  if (look.saltRim) drawSalt(ctx, s, Y);
  drawRivulets(ctx, s, Y);
  if (look.garnish && look.garnish !== 'cherry') drawGarnish(ctx, s, Y);
  if (opts.showTarget) drawTarget(ctx, profile, Y);
  ctx.restore();

  drawDrops(ctx, s);
}

/** Innenkontur als Pfad; `extra` verlängert ihn senkrecht über den Rand. */
function innerPath(
  ctx: CanvasRenderingContext2D,
  contour: readonly (readonly [number, number])[],
  Y: (y: number) => number,
  extra: number,
) {
  ctx.beginPath();
  contour.forEach(([w, y], i) => (i ? ctx.lineTo(-w, Y(y)) : ctx.moveTo(-w, Y(y))));
  const [rw, rh] = contour[contour.length - 1];
  if (extra) {
    ctx.lineTo(-rw, Y(rh + extra));
    ctx.lineTo(rw, Y(rh + extra));
  }
  for (let i = contour.length - 1; i >= 0; i--) ctx.lineTo(contour[i][0], Y(contour[i][1]));
  ctx.closePath();
}

/** Tisch: Schatten, durchs Getränk gefärbtes Licht und verschüttete Pfützen. */
function drawTable(ctx: CanvasRenderingContext2D, s: GlassSim, fill: number) {
  const { profile, look } = s;
  const foot = profile.stem ? (profile.foot ?? 30) : profile.points[0][0] + profile.wall;
  const cx = STAGE.centerX + s.offset;
  const shadow = ctx.createRadialGradient(cx + 6, STAGE.table + 2, 2, cx + 6, STAGE.table + 2, foot * 1.6);
  shadow.addColorStop(0, 'rgba(0,0,0,0.6)');
  shadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(cx + 6, STAGE.table + 2, foot * 1.6, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  // Licht, das durch die Flüssigkeit fällt, landet farbig rechts neben dem
  // Glas – das Licht kommt von links oben.
  if (fill > 0.1) {
    const r = foot * 1.5 + 10;
    const glow = ctx.createRadialGradient(cx + foot * 0.9, STAGE.table + 3, 1, cx + foot * 0.9, STAGE.table + 3, r);
    glow.addColorStop(0, withAlpha(look.top, Math.min(0.42, fill * 0.45)));
    glow.addColorStop(1, withAlpha(look.top, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(cx + foot * 0.9, STAGE.table + 3, r, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of s.puddles) {
    const fade = Math.max(0, 1 - Math.max(0, p.age - 3) / 3);
    const spread = p.r * (1 + Math.min(0.4, p.age * 0.25));
    ctx.fillStyle = p.foam ? `rgba(250,240,215,${0.55 * fade})` : withAlpha(look.mid, 0.5 * fade);
    ctx.beginPath();
    ctx.ellipse(p.x, STAGE.table + 1, spread, spread * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.25 * fade})`;
    ctx.beginPath();
    ctx.ellipse(p.x - spread * 0.3, STAGE.table, spread * 0.35, spread * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStem(ctx: CanvasRenderingContext2D, profile: GlassProfile) {
  const foot = profile.foot ?? 30;
  const top = -(profile.stem + 3);
  const g = ctx.createLinearGradient(-4, 0, 4, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.32)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.08)');
  g.addColorStop(1, 'rgba(255,255,255,0.22)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-2.2, top);
  ctx.quadraticCurveTo(-1.6, top / 2, -3.5, -3);
  ctx.lineTo(3.5, -3);
  ctx.quadraticCurveTo(1.6, top / 2, 2.2, top);
  ctx.closePath();
  ctx.fill();
  // Fuß: flache Scheibe, vorne die helle Kante.
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.ellipse(0, -1.5, foot, foot * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK.outline;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, -1.5, foot, foot * 0.16, 0, 0, Math.PI);
  ctx.stroke();
}

/** Ein Streifen der Oberfläche als Polygon: Kurve oben, beliebig weit nach unten. */
function surfacePath(
  ctx: CanvasRenderingContext2D,
  s: GlassSim,
  Y: (y: number) => number,
  lift: (x: number) => number,
  bottom: number,
) {
  ctx.beginPath();
  for (let i = 0; i < COLUMNS; i++) {
    const x = s.colX[i];
    const y = Y(s.surface[i] + lift(x));
    if (i === 0) {
      ctx.moveTo(x - 30, Y(bottom));
      ctx.lineTo(x - 30, y);
    }
    ctx.lineTo(x, y);
  }
  ctx.lineTo(s.colX[COLUMNS - 1] + 30, Y(s.surface[COLUMNS - 1] + lift(s.colX[COLUMNS - 1])));
  ctx.lineTo(s.colX[COLUMNS - 1] + 30, Y(bottom));
  ctx.closePath();
}

/** Wandabstand der Oberfläche, einmal je Bild gemessen statt je Stützstelle. */
let surfaceHalf = 1;

/** Halbe Tiefe der Oberflächen-Ellipse an der Stelle x. */
function ellipseDepth(_s: GlassSim, x: number): number {
  const half = surfaceHalf;
  const r = Math.min(1, Math.abs(x) / half);
  return half * TILT_VIEW * Math.sqrt(Math.max(0, 1 - r * r));
}

function drawLiquid(ctx: CanvasRenderingContext2D, s: GlassSim, Y: (y: number) => number, opts: DrawOptions) {
  const { profile, look } = s;
  const top = s.center;
  if (top <= 0.5 && s.surface.every((y) => y <= 0.5)) return;

  // Körper: bis zur hinteren Kante der Oberfläche, oben heller.
  const body = ctx.createLinearGradient(0, Y(Math.max(top, 8)), 0, Y(0));
  body.addColorStop(0, look.top);
  body.addColorStop(0.5, look.mid);
  body.addColorStop(1, look.bottom);
  ctx.fillStyle = body;
  surfacePath(ctx, s, Y, (x) => ellipseDepth(s, x), -10);
  ctx.fill();

  // Licht von links: links heller, rechts im Schatten, wie ein runder Körper.
  const shade = ctx.createLinearGradient(-profile.points[0][0] - 20, 0, rimHalfWidth(profile) + 20, 0);
  shade.addColorStop(0, 'rgba(255,255,255,0.16)');
  shade.addColorStop(0.35, 'rgba(255,255,255,0)');
  shade.addColorStop(0.75, 'rgba(0,0,0,0.06)');
  shade.addColorStop(1, 'rgba(0,0,0,0.26)');
  ctx.fillStyle = shade;
  ctx.fill();
  if (look.cloudy) {
    ctx.fillStyle = 'rgba(255,236,190,0.2)';
    ctx.fill();
  }

  // Was noch im Magen liegt: die oberste Schicht, frisch und heller.
  const pendingPx = s.pending * profile.height;
  if (pendingPx > 0.8) {
    ctx.save();
    surfacePath(ctx, s, Y, (x) => ellipseDepth(s, x), -10);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,250,228,0.22)';
    surfacePath(ctx, s, Y, () => 0, -10);
    ctx.beginPath();
    for (let i = 0; i < COLUMNS; i++) {
      const y = Y(s.surface[i] + ellipseDepth(s, s.colX[i]) + 1);
      if (i) ctx.lineTo(s.colX[i], y);
      else ctx.moveTo(s.colX[i], y);
    }
    for (let i = COLUMNS - 1; i >= 0; i--) ctx.lineTo(s.colX[i], Y(s.surface[i] - pendingPx));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawFilm(ctx, s, Y, opts);
  if (look.garnish === 'cherry') drawCherry(ctx, s, Y);
  drawBubbles(ctx, s, Y, opts);
  drawIce(ctx, s, Y);
  if (look.straw) drawStrawUnder(ctx, s, Y);

  // Oberfläche von oben: das Band zwischen vorderer und hinterer Kante.
  ctx.beginPath();
  for (let i = 0; i < COLUMNS; i++) {
    const x = s.colX[i];
    const y = Y(s.surface[i] + ellipseDepth(s, x));
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  for (let i = COLUMNS - 1; i >= 0; i--) {
    const x = s.colX[i];
    ctx.lineTo(x, Y(s.surface[i] - ellipseDepth(s, x)));
  }
  ctx.closePath();
  const face = ctx.createLinearGradient(-wallX(s), 0, wallX(s), 0);
  face.addColorStop(0, withAlpha(look.top, 0.95));
  // Spiegelung des Lichts: auf dunklem Rotwein schwächer als auf hellem Bier.
  face.addColorStop(0.3, `rgba(255,255,255,${luminance(look.top) > 0.5 ? 0.5 : 0.28})`);
  face.addColorStop(0.55, withAlpha(look.top, 0.9));
  face.addColorStop(1, withAlpha(look.mid, 0.95));
  ctx.fillStyle = face;
  ctx.fill();
  // Vorderkante mit Meniskus: ein heller Saum, wo die Oberfläche das Licht bricht.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < COLUMNS; i++) {
    const x = s.colX[i];
    const y = Y(s.surface[i] - ellipseDepth(s, x));
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.stroke();
}

/** Film an der Wand nach dem Schwappen – beim Wein als Tränen, die abrinnen. */
function drawFilm(ctx: CanvasRenderingContext2D, s: GlassSim, Y: (y: number) => number, opts: DrawOptions) {
  const { look, profile } = s;
  if (!look.film) return;
  const x = wallX(s);
  for (const side of [-1, 1] as const) {
    const from = surfaceAt(s, side * x);
    const to = side < 0 ? s.wetLeft : s.wetRight;
    if (to - from < 1.5) continue;
    ctx.strokeStyle = withAlpha(look.bottom, 0.3 * look.film);
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    for (let y = from; y <= to; y += 2) {
      const px = side * (halfWidthAt(profile, y) - 1.2);
      if (y === from) ctx.moveTo(px, Y(y));
      else ctx.lineTo(px, Y(y));
    }
    ctx.stroke();
    // Tränen: dicke Tropfen am unteren Ende des Films, die langsam fallen.
    ctx.fillStyle = withAlpha(look.bottom, 0.55 * look.film);
    const span = to - from;
    for (let k = 0; k < Math.min(5, span / 8); k++) {
      const y = to - ((opts.time * 5 + k * 9.7) % span);
      const px = side * (halfWidthAt(profile, y) - 2 - (k % 2) * 4);
      ctx.beginPath();
      ctx.ellipse(px, Y(y), 1.5, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBubbles(ctx: CanvasRenderingContext2D, s: GlassSim, Y: (y: number) => number, opts: DrawOptions) {
  const { look } = s;
  if (!look.bubbles) return;
  ctx.strokeStyle = look.fineBead ? 'rgba(255,252,236,0.7)' : 'rgba(255,246,214,0.62)';
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 0.7;
  const list = opts.still ? stillBubbles(s) : s.bubbles;
  for (const b of list) {
    ctx.beginPath();
    ctx.arc(b.x, Y(b.y), b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

/** Im Standbild stehen die Perlen still, aber da. */
function stillBubbles(s: GlassSim) {
  const out: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < 18; i++) {
    const y = ((i * 37.3) % 100) / 100 * Math.max(0, s.center - 6);
    const half = halfWidthAt(s.profile, y) * 0.8;
    out.push({ x: Math.sin(i * 12.7) * half, y, r: 0.6 + (i % 3) * 0.4 });
  }
  return out;
}

function drawIce(ctx: CanvasRenderingContext2D, s: GlassSim, Y: (y: number) => number) {
  for (const c of s.ice) {
    ctx.save();
    ctx.translate(c.x, Y(c.y));
    ctx.rotate(-c.angle);
    const h = c.size / 2;
    roundRect(ctx, -h, -h, c.size, c.size, 5);
    const g = ctx.createLinearGradient(-h, -h, h, h);
    g.addColorStop(0, 'rgba(255,255,255,0.42)');
    g.addColorStop(0.5, 'rgba(225,244,255,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0.3)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Bruchkanten im Eis.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(-h + 4, -h + 7);
    ctx.lineTo(h - 6, -h + 4);
    ctx.moveTo(-h + 6, h - 5);
    ctx.lineTo(-h + 3, -h + 10);
    ctx.stroke();
    ctx.restore();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCherry(ctx: CanvasRenderingContext2D, s: GlassSim, Y: (y: number) => number) {
  // Die Kirsche ist schwerer als der Drink und liegt am Grund.
  const x = halfWidthAt(s.profile, 6) * 0.45;
  const g = ctx.createRadialGradient(x - 2.5, Y(9), 1, x, Y(7.5), 8);
  g.addColorStop(0, '#e2425a');
  g.addColorStop(1, '#6d0718');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, Y(7.5), 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5b2a18';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x, Y(14.5));
  ctx.quadraticCurveTo(x + 4, Y(24), x + 10, Y(28));
  ctx.stroke();
}

/** Strohhalm: von unten links schräg über den Rand hinaus. */
function strawLine(s: GlassSim) {
  const { profile } = s;
  // Nach links geneigt: rechts oben sitzt der Stempel mit dem Pegel.
  const from = { x: profile.points[0][0] * 0.45, y: 4 };
  const to = { x: -rimHalfWidth(profile) * 0.8, y: profile.height + 34 };
  return { from, to };
}

function strokeStraw(ctx: CanvasRenderingContext2D, Y: (y: number) => number, from: { x: number; y: number }, to: { x: number; y: number }, dx: number, alpha: number) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(226,70,58,${alpha})`;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(from.x + dx, Y(from.y));
  ctx.lineTo(to.x + dx, Y(to.y));
  ctx.stroke();
  ctx.strokeStyle = `rgba(255,220,210,${alpha * 0.6})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(from.x + dx - 2, Y(from.y));
  ctx.lineTo(to.x + dx - 2, Y(to.y));
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/** Unter Wasser knickt der Halm optisch weg – Lichtbrechung an der Oberfläche. */
function drawStrawUnder(ctx: CanvasRenderingContext2D, s: GlassSim, Y: (y: number) => number) {
  const { from, to } = strawLine(s);
  ctx.save();
  surfacePath(ctx, s, Y, () => 0, -10);
  ctx.clip();
  strokeStraw(ctx, Y, from, to, -3.5, 0.7);
  ctx.fillStyle = withAlpha(s.look.mid, 0.12);
  ctx.fill();
  ctx.restore();
}

function drawStraw(ctx: CanvasRenderingContext2D, s: GlassSim, Y: (y: number) => number) {
  const { from, to } = strawLine(s);
  ctx.save();
  // Alles oberhalb der Oberfläche.
  ctx.beginPath();
  for (let i = 0; i < COLUMNS; i++) {
    const x = s.colX[i];
    const y = Y(s.surface[i]);
    if (i) ctx.lineTo(x, y);
    else {
      ctx.moveTo(x - 60, Y(400));
      ctx.lineTo(x - 60, y);
      ctx.lineTo(x, y);
    }
  }
  ctx.lineTo(s.colX[COLUMNS - 1] + 60, Y(s.surface[COLUMNS - 1]));
  ctx.lineTo(s.colX[COLUMNS - 1] + 60, Y(400));
  ctx.closePath();
  ctx.clip();
  strokeStraw(ctx, Y, from, to, 0, 0.95);
  ctx.restore();
}

function drawFoam(ctx: CanvasRenderingContext2D, s: GlassSim, Y: (y: number) => number, opts: DrawOptions) {
  const fh = foamHeight(s);
  if (fh < 0.5 || s.center <= 1) return;
  const fine = s.look.fineBead;
  // Schaum ist steif: er folgt nur den langen Wellen, nicht den Kräuseln.
  const top = (i: number) => {
    const x = s.colX[i];
    const smooth = (surfaceAt(s, x - 6) + surfaceAt(s, x) + surfaceAt(s, x + 6)) / 3;
    const bumps = opts.still ? 0 : Math.sin(x * 0.45 + opts.time * 0.6) * 0.6 + Math.sin(x * 1.3) * 0.5;
    return smooth + fh + bumps;
  };
  // Vorderseite der Krone, von der Flüssigkeit bis zur vorderen Oberkante.
  ctx.beginPath();
  for (let i = 0; i < COLUMNS; i++) {
    const x = s.colX[i];
    const y = Y(s.surface[i] - ellipseDepth(s, x));
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  for (let i = COLUMNS - 1; i >= 0; i--) ctx.lineTo(s.colX[i], Y(top(i) - ellipseDepth(s, s.colX[i])));
  ctx.closePath();
  const g = ctx.createLinearGradient(-wallX(s), 0, wallX(s), 0);
  g.addColorStop(0, fine ? 'rgba(255,253,240,0.75)' : INK.foam);
  g.addColorStop(1, fine ? 'rgba(240,226,190,0.7)' : INK.foamShade);
  ctx.fillStyle = g;
  ctx.fill();
  if (!fine) {
    // Grobe Bläschen in der Krone, an die Krone geheftet.
    ctx.strokeStyle = 'rgba(200,170,120,0.35)';
    ctx.lineWidth = 0.6;
    for (let k = 0; k < 34; k++) {
      const x = -wallX(s) + ((k * 23.7) % (2 * wallX(s)));
      const i = Math.max(0, Math.min(COLUMNS - 1, Math.round(((x - s.colX[0]) / (s.colX[1] - s.colX[0])))));
      const lo = s.surface[i] - ellipseDepth(s, x);
      const hi = top(i) - ellipseDepth(s, x);
      const y = lo + ((k * 0.618) % 1) * (hi - lo);
      ctx.beginPath();
      ctx.arc(x, Y(y), 0.8 + (k % 3) * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // Oberseite der Krone: hell, cremig.
  ctx.beginPath();
  for (let i = 0; i < COLUMNS; i++) {
    const x = s.colX[i];
    const y = Y(top(i) - ellipseDepth(s, x));
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  for (let i = COLUMNS - 1; i >= 0; i--) ctx.lineTo(s.colX[i], Y(top(i) + ellipseDepth(s, s.colX[i])));
  ctx.closePath();
  ctx.fillStyle = fine ? 'rgba(255,253,240,0.8)' : INK.foamTop;
  ctx.fill();
}

/** Der Strahl beim Einschenken, von oben bis in die Oberfläche. */
function drawPour(ctx: CanvasRenderingContext2D, s: GlassSim, Y: (y: number) => number) {
  if (s.pour <= 0) return;
  const jet = Math.min(1, s.pour / 0.25);
  const x = s.pourX;
  const surface = surfaceAt(s, x);
  const topY = Y(s.profile.height + 160);
  const w = 4.5 * jet + 0.8;
  const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
  g.addColorStop(0, withAlpha(s.look.top, 0.55));
  g.addColorStop(0.4, withAlpha(s.look.top, 0.95));
  g.addColorStop(1, withAlpha(s.look.mid, 0.8));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.7, topY);
  ctx.lineTo(x + w * 0.7, topY);
  ctx.lineTo(x + w / 2, Y(surface));
  ctx.lineTo(x - w / 2, Y(surface));
  ctx.closePath();
  ctx.fill();
  // Aufgewühlte Stelle, wo der Strahl eintaucht.
  ctx.fillStyle = s.look.foam ? 'rgba(255,250,235,0.85)' : 'rgba(255,255,255,0.35)';
  for (let k = 0; k < 5; k++) {
    ctx.beginPath();
    ctx.arc(x + Math.sin(k * 2.3 + s.time * 30) * 5, Y(surface + 1 + (k % 2)), 1.5 + (k % 3), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Glas: Wandstärke, schwerer Boden, Lichtkanten. */
function drawWalls(
  ctx: CanvasRenderingContext2D,
  s: GlassSim,
  contour: readonly (readonly [number, number])[],
  Y: (y: number) => number,
) {
  const { profile } = s;
  const wall = profile.wall;
  const rim = rimHalfWidth(profile);
  const bottom = -profile.base;
  // Außenkontur.
  const outer = () => {
    ctx.beginPath();
    const [w0] = contour[0];
    ctx.moveTo(-(w0 + wall) + (profile.stem ? 0 : 3), Y(bottom));
    contour.forEach(([w, y]) => ctx.lineTo(-(w + wall), Y(y)));
    for (let i = contour.length - 1; i >= 0; i--) ctx.lineTo(contour[i][0] + wall, Y(contour[i][1]));
    ctx.lineTo(w0 + wall - (profile.stem ? 0 : 3), Y(bottom));
    ctx.closePath();
  };
  // Glasmasse zwischen innen und außen, unten der volle Boden.
  ctx.save();
  outer();
  ctx.fillStyle = INK.wall;
  ctx.fill();
  ctx.restore();
  if (profile.base > 3) {
    const w0 = contour[0][0];
    const g = ctx.createLinearGradient(0, Y(0), 0, Y(bottom));
    g.addColorStop(0, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0.05)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, Y(0), w0, w0 * TILT_VIEW, 0, 0, Math.PI);
    ctx.lineTo(-(w0 + wall) + 3, Y(bottom));
    ctx.lineTo(w0 + wall - 3, Y(bottom));
    ctx.closePath();
    ctx.fill();
    // Lichtfang im Boden.
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, Y(bottom / 2), w0 * 0.75, w0 * TILT_VIEW * 0.7, 0, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
  ctx.strokeStyle = INK.outline;
  ctx.lineWidth = 1.4;
  ctx.lineJoin = 'round';
  outer();
  ctx.stroke();
  // Innenkante, kaum sichtbar.
  ctx.strokeStyle = INK.inner;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  contour.forEach(([w, y], i) => (i ? ctx.lineTo(-w, Y(y)) : ctx.moveTo(-w, Y(y))));
  ctx.stroke();
  ctx.beginPath();
  contour.forEach(([w, y], i) => (i ? ctx.lineTo(w, Y(y)) : ctx.moveTo(w, Y(y))));
  ctx.stroke();
  // Vorderer Rand: hell, das Licht sitzt auf der Kante.
  ctx.strokeStyle = 'rgba(255,248,236,0.62)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(0, Y(profile.height), rim + wall / 2, Math.max(2.5, rim * TILT_VIEW), 0, 0, Math.PI);
  ctx.stroke();
  // Glanzstreifen: lang links, kurz rechts – das Fenster spiegelt sich.
  const shine = (side: -1 | 1, from: number, to: number, inset: number, width: number, alpha: number) => {
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let y = from; y <= to; y += 4) {
      const x = side * (halfWidthAt(profile, y) - inset);
      if (y === from) ctx.moveTo(x, Y(y));
      else ctx.lineTo(x, Y(y));
    }
    ctx.stroke();
    ctx.lineCap = 'butt';
  };
  const h = profile.height;
  shine(-1, h * 0.12, h * 0.86, 6, 3.2, 0.2);
  shine(-1, h * 0.2, h * 0.5, 10, 1.2, 0.16);
  shine(1, h * 0.55, h * 0.8, 4, 1.6, 0.14);
}

/** Kondenswasser auf kaltem Glas – nur dort, wo das kalte Getränk dahinter steht. */
const dewCache = new WeakMap<GlassProfile, { x: number; y: number; r: number }[]>();
function drawCondensation(ctx: CanvasRenderingContext2D, s: GlassSim, Y: (y: number) => number) {
  const { profile } = s;
  let dew = dewCache.get(profile);
  if (!dew) {
    dew = [];
    let seed = 11;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 46; i++) {
      const y = 4 + rnd() * (profile.height - 8);
      const half = halfWidthAt(profile, y) + profile.wall * 0.5;
      dew.push({ x: (rnd() * 2 - 1) * half * 0.96, y, r: 0.6 + rnd() * rnd() * 2.2 });
    }
    dewCache.set(profile, dew);
  }
  for (const d of dew) {
    if (d.y > surfaceAt(s, d.x) + 4) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.arc(d.x, Y(d.y), d.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(d.x - d.r * 0.35, Y(d.y) - d.r * 0.35, Math.max(0.35, d.r * 0.3), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSalt(ctx: CanvasRenderingContext2D, s: GlassSim, Y: (y: number) => number) {
  const { profile } = s;
  const rim = rimHalfWidth(profile) + profile.wall;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let k = 0; k < 40; k++) {
    const t = (k * 0.618) % 1;
    const x = -rim + t * rim * 2;
    const depth = Math.sqrt(Math.max(0, 1 - (x / rim) ** 2)) * rim * TILT_VIEW;
    const y = profile.height - ((k * 0.37) % 1) * 4;
    ctx.fillRect(x, Y(y) + depth, 1.3, 1.3);
  }
}

function drawRivulets(ctx: CanvasRenderingContext2D, s: GlassSim, Y: (y: number) => number) {
  const { profile, look } = s;
  for (const r of s.rivulets) {
    const yFrom = profile.height - r.tail;
    const yTo = profile.height - r.head;
    if (yFrom - yTo < 0.5) continue;
    const at = (y: number) => r.side * (halfWidthAt(profile, Math.max(0, y)) + profile.wall + r.width / 2 - 0.8);
    if (r.foam) {
      // Schaum läuft nicht als Strich, sondern in Klumpen, die sich lösen.
      ctx.fillStyle = 'rgba(250,243,226,0.93)';
      for (let y = yFrom; y >= yTo; y -= 2.2) {
        const lump = 0.62 + 0.38 * Math.sin(y * 0.8 + r.side * 2 + r.age);
        ctx.beginPath();
        ctx.arc(at(y) + r.side * lump * 0.8, Y(y), (r.width / 2) * lump, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(at(yTo), Y(yTo), r.width * 0.55, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = withAlpha(look.mid, 0.78);
    ctx.lineWidth = r.width;
    ctx.beginPath();
    for (let y = yFrom; y >= yTo; y -= 3) {
      if (y === yFrom) ctx.moveTo(at(y), Y(y));
      else ctx.lineTo(at(y), Y(y));
    }
    ctx.lineTo(at(yTo), Y(yTo));
    ctx.stroke();
    // Der Kopf ist ein Tropfen, der den Rest hinter sich herzieht.
    ctx.fillStyle = withAlpha(look.top, 0.9);
    ctx.beginPath();
    ctx.arc(at(yTo), Y(yTo), r.width * 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(at(yFrom) - r.side * 0.6, Y(yFrom));
    ctx.lineTo(at(yTo) - r.side * 0.6, Y(yTo));
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
}

function drawGarnish(ctx: CanvasRenderingContext2D, s: GlassSim, Y: (y: number) => number) {
  const { profile, look } = s;
  const rim = rimHalfWidth(profile) + profile.wall;
  const citrus =
    look.garnish === 'orange'
      ? { peel: '#ef7c18', pith: '#ffe9c8', pulp: '#ffa437', seg: '#ffd58f', r: 17 }
      : { peel: '#4f9a26', pith: '#eef7d4', pulp: '#b9df58', seg: '#e3f4a8', r: 13 };
  ctx.save();
  ctx.translate(rim - 3, Y(profile.height + citrus.r * 0.45));
  if (look.garnish === 'limeWedge') {
    // Spalte: ein halber Kreis, aufgesteckt.
    ctx.rotate(-0.5);
    ctx.fillStyle = citrus.peel;
    ctx.beginPath();
    ctx.arc(0, 0, citrus.r, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = citrus.pulp;
    ctx.beginPath();
    ctx.arc(0, 0, citrus.r - 2.4, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = citrus.seg;
    ctx.lineWidth = 0.8;
    for (let k = 1; k < 4; k++) {
      const a = (k / 4) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * (citrus.r - 3), Math.sin(a) * (citrus.r - 3));
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  ctx.rotate(-0.25);
  ctx.fillStyle = citrus.peel;
  ctx.beginPath();
  ctx.arc(0, 0, citrus.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = citrus.pith;
  ctx.beginPath();
  ctx.arc(0, 0, citrus.r - 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = citrus.pulp;
  ctx.beginPath();
  ctx.arc(0, 0, citrus.r - 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = citrus.seg;
  ctx.lineWidth = 1;
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * (citrus.r - 3.4), Math.sin(a) * (citrus.r - 3.4));
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.arc(-citrus.r * 0.3, -citrus.r * 0.35, citrus.r * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTarget(ctx: CanvasRenderingContext2D, profile: GlassProfile, Y: (y: number) => number) {
  const y = profile.height * 0.72;
  const width = halfWidthAt(profile, y) + profile.wall;
  ctx.strokeStyle = INK.target;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(width - 16, Y(y));
  ctx.lineTo(width + 8, Y(y));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = INK.target;
  ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('ZIEL', width + 12, Y(y) + 4);
}

function drawDrops(ctx: CanvasRenderingContext2D, s: GlassSim) {
  const { look } = s;
  for (const d of s.drops) {
    // Tropfenform: vorn rund, hinten ein Schweif in Gegenrichtung des Flugs –
    // so sieht ein schneller Tropfen auf einem Foto aus.
    const speed = Math.hypot(d.vx, d.vy) || 1;
    const angle = Math.atan2(d.vy, d.vx);
    const tail = d.r + Math.min(8, speed * 0.008);
    ctx.fillStyle = d.foam ? 'rgba(250,242,222,0.95)' : withAlpha(look.top, 0.92);
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, angle - Math.PI / 2, angle + Math.PI / 2);
    ctx.lineTo(d.x - Math.cos(angle) * tail, d.y - Math.sin(angle) * tail);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    ctx.arc(d.x - d.r * 0.3, d.y - d.r * 0.3, Math.max(0.3, d.r * 0.32), 0, Math.PI * 2);
    ctx.fill();
  }
}
