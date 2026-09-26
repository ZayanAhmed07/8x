// Draws the Tally mark (four bars) as PNGs so the repo has no hand-made binary assets.
// Run: node scripts/make-icons.js
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) pixel(x, y).forEach((value, i) => { raw[y * (size * 4 + 1) + 1 + x * 4 + i] = value; });
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const INK = [29, 28, 25, 255];
const ACCENT = [194, 65, 12, 255];
const RED = [217, 45, 32, 255];
const CLEAR = [0, 0, 0, 0];
const BARS = [0.45, 1, 0.7, 0.28];

/** Rounded square tile with the bar mark, or bare bars for the tray. */
function mark(size, { tile, color }) {
  const pad = tile ? size * 0.2 : size * 0.08;
  const inner = size - pad * 2;
  const gap = inner * 0.1;
  const barWidth = (inner - gap * 3) / 4;
  const radius = size * 0.22;
  return png(size, (x, y) => {
    if (tile) {
      const dx = Math.max(radius - x, x - (size - 1 - radius), 0);
      const dy = Math.max(radius - y, y - (size - 1 - radius), 0);
      if (dx * dx + dy * dy > radius * radius) return CLEAR;
    }
    const column = Math.floor((x - pad) / (barWidth + gap));
    const inBar = x >= pad && column >= 0 && column < 4 && (x - pad) - column * (barWidth + gap) < barWidth;
    if (inBar && y >= pad + inner * (1 - BARS[column]) && y < size - pad) return tile ? [255, 255, 255, 255] : color;
    return tile ? color : CLEAR;
  });
}

const out = (file, data) => { fs.writeFileSync(path.join(__dirname, "..", file), data); console.log("wrote", file); };
out("build/icon.png", mark(256, { tile: true, color: ACCENT }));
out("src/assets/icon.png", mark(64, { tile: true, color: ACCENT }));
out("src/assets/tray.png", mark(32, { tile: false, color: INK }));
out("src/assets/tray-recording.png", mark(32, { tile: false, color: RED }));
