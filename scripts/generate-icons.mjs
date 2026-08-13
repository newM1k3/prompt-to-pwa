// ============================================================================
// generate-icons.mjs - Generates App Genie PWA icons (pure Node, no deps)
// Usage: node scripts/generate-icons.mjs
// Output: public/icons/icon-192.png, icon-512.png, icon-maskable-512.png,
//         public/apple-touch-icon.png
// ============================================================================
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../public/icons");
const APPLE_ICON = resolve(__dirname, "../public/apple-touch-icon.png");

// ---- Minimal PNG encoder (RGBA, 8-bit) ----
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---- Drawing (coverage functions, supersampled) ----
const SS = 4; // supersample factor

function roundedRectCoverage(px, py, size, radiusFrac) {
  const r = size * radiusFrac;
  // inside expanded rect, then corners
  if (px < r && py < r) {
    const dx = r - px, dy = r - py;
    return dx * dx + dy * dy <= r * r ? 1 : 0;
  }
  if (px > size - r && py < r) {
    const dx = px - (size - r), dy = r - py;
    return dx * dx + dy * dy <= r * r ? 1 : 0;
  }
  if (px < r && py > size - r) {
    const dx = r - px, dy = py - (size - r);
    return dx * dx + dy * dy <= r * r ? 1 : 0;
  }
  if (px > size - r && py > size - r) {
    const dx = px - (size - r), dy = py - (size - r);
    return dx * dx + dy * dy <= r * r ? 1 : 0;
  }
  return 1;
}

function diamondCoverage(dx, dy, a, b) {
  const d = Math.abs(dx) / a + Math.abs(dy) / b;
  return d <= 1 ? 1 : 0;
}

function circleCoverage(dx, dy, r) {
  return dx * dx + dy * dy <= r * r ? 1 : 0;
}

/**
 * Render one icon.
 * @param {number} size output pixel size
 * @param {{ rounded: boolean, sparkleScale: number }} opts
 */
function renderIcon(size, { rounded, sparkleScale }) {
  const out = Buffer.alloc(size * size * 4);
  const S = size;
  const cx = S * 0.5;
  const cy = S * 0.48;
  const sc = S * sparkleScale;
  const aV = sc * 0.13;   // vertical diamond half-width
  const bV = sc * 0.52;   // vertical diamond half-height
  const aH = sc * 0.52;   // horizontal diamond half-width
  const bH = sc * 0.13;   // horizontal diamond half-height
  const dot1 = { x: S * 0.71, y: S * 0.27, r: S * 0.075 };   // light blue dust
  const dot2 = { x: S * 0.63, y: S * 0.19, r: S * 0.045 };   // white dust
  const glowR = S * 0.46;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let rAcc = 0, gAcc = 0, bAcc = 0, aAcc = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          const inside = rounded ? roundedRectCoverage(px, py, S, 0.22) : 1;
          if (!inside) continue;
          // background gradient (primary-500 -> primary-700)
          const t = py / S;
          const bgR = 59 + (29 - 59) * t;   // 0x3B -> 0x1D
          const bgG = 130 + (78 - 130) * t; // 0x82 -> 0x4E
          const bgB = 246 + (216 - 246) * t; // 0xF6 -> 0xD8
          let r = bgR, g = bgG, b = bgB;
          // soft glow behind sparkle
          const gd = Math.hypot(px - cx, py - cy) / glowR;
          if (gd < 1) {
            const glow = (1 - gd) * 0.16;
            r += (255 - r) * glow;
            g += (255 - g) * glow;
            b += (255 - b) * glow;
          }
          const dx = px - cx, dy = py - cy;
          const star =
            diamondCoverage(dx, dy, aV, bV) ||
            diamondCoverage(dx, dy, aH, bH);
          if (star) { r = 255; g = 255; b = 255; }
          else if (circleCoverage(px - dot1.x, py - dot1.y, dot1.r)) {
            r = 219; g = 234; b = 254; // primary-100
          } else if (circleCoverage(px - dot2.x, py - dot2.y, dot2.r)) {
            r = 255; g = 255; b = 255;
          }
          rAcc += r; gAcc += g; bAcc += b; aAcc += 255;
        }
      }
      const n = SS * SS;
      const o = (y * S + x) * 4;
      out[o] = Math.round(rAcc / n);
      out[o + 1] = Math.round(gAcc / n);
      out[o + 2] = Math.round(bAcc / n);
      out[o + 3] = Math.round(aAcc / n);
    }
  }
  return encodePNG(S, S, out);
}

mkdirSync(OUT_DIR, { recursive: true });
const jobs = [
  { file: resolve(OUT_DIR, "icon-192.png"), size: 192, opts: { rounded: true, sparkleScale: 0.55 } },
  { file: resolve(OUT_DIR, "icon-512.png"), size: 512, opts: { rounded: true, sparkleScale: 0.55 } },
  { file: resolve(OUT_DIR, "icon-maskable-512.png"), size: 512, opts: { rounded: false, sparkleScale: 0.45 } },
  { file: APPLE_ICON, size: 180, opts: { rounded: false, sparkleScale: 0.52 } },
];
for (const job of jobs) {
  const png = renderIcon(job.size, job.opts);
  writeFileSync(job.file, png);
  console.log(`generated ${job.file} (${png.length} bytes)`);
}