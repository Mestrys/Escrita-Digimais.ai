// Gera ícones PNG simples (balão de texto) sem dependências externas.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function pixel(u, v) {
  // u, v em [0,1]
  if (!inRoundRect(u, v, 0, 0, 1, 1, 0.22)) return [0, 0, 0, 0];
  const bg = [11, 92, 173, 255];
  const white = [255, 255, 255, 255];
  const bubble = inRoundRect(u, v, 0.16, 0.18, 0.84, 0.66, 0.1) || (v > 0.6 && v < 0.82 && u > 0.22 + (v - 0.6) * 0.2 && u < 0.4 - (v - 0.6) * 0.8);
  if (!bubble) return bg;
  const line = (y) => v > y - 0.035 && v < y + 0.035;
  if ((line(0.32) && u > 0.26 && u < 0.74) || (line(0.44) && u > 0.26 && u < 0.62) || (line(0.56) && u > 0.26 && u < 0.7)) return bg;
  return white;
}

function png(size) {
  const ss = 3;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const [pr, pg, pb, pa] = pixel((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size);
        r += pr * pa; g += pg * pa; b += pb * pa; a += pa;
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      const n = ss * ss;
      raw[o] = a ? Math.round(r / a) : 0;
      raw[o + 1] = a ? Math.round(g / a) : 0;
      raw[o + 2] = a ? Math.round(b / a) : 0;
      raw[o + 3] = Math.round(a / n);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });
for (const s of [16, 32, 48, 128]) writeFileSync(`public/icons/icon${s}.png`, png(s));
console.log('Ícones gerados.');
