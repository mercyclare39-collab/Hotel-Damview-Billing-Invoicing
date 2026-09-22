import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createCRC32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
}

const crcTable = createCRC32Table();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  const crcVal = crc32(typeAndData);
  chunk.writeUInt32BE(crcVal, 8 + len);
  return chunk;
}

function createPng(width, height, drawFn) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit depth
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Raw image data with filter byte per row
  const stride = width * 4;
  const rawData = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (stride + 1);
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function drawDamviewIcon(x, y, w, h, isMaskable = false) {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 2;
  const dx = (x - cx) / r;
  const dy = (y - cy) / r;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Background: Deep luxury stone navy (#1c1917 -> #0c0a09)
  const bgR = 28;
  const bgG = 25;
  const bgB = 23;

  if (isMaskable) {
    // Maskable full bleed background
    // Central emblem within 70% safe zone
    if (dist < 0.65) {
      // Golden circle rim
      if (dist > 0.58 && dist < 0.64) {
        return [217, 119, 6, 255]; // Amber 600
      }
      // Inner badge
      if (dist <= 0.58) {
        // Hotel "H" and building silhouette / Dam / Shield pattern in center
        const nx = (x - cx) / (r * 0.5);
        const ny = (y - cy) / (r * 0.5);
        // Stylized "H" / Dam view monogram
        const inLeftBar = nx >= -0.55 && nx <= -0.25 && ny >= -0.6 && ny <= 0.6;
        const inRightBar = nx >= 0.25 && nx <= 0.55 && ny >= -0.6 && ny <= 0.6;
        const inCrossBar = nx >= -0.55 && nx <= 0.55 && ny >= -0.15 && ny <= 0.15;
        const inRoof = ny < -0.4 && Math.abs(nx) < (0.6 - (ny + 0.6) * 0.8);

        if (inLeftBar || inRightBar || inCrossBar || inRoof) {
          return [245, 158, 11, 255]; // Amber 500
        }
        return [41, 37, 36, 255]; // Stone 800
      }
    }
    return [bgR, bgG, bgB, 255];
  } else {
    // Rounded squircle icon with gold border
    // Corner radius for standard app icon
    const pad = w * 0.05;
    if (x < pad || x > w - pad || y < pad || y > h - pad) {
      // transparent corner outside rounded box if distance > radius
    }
    // Subtle luxury gradient
    const t = y / h;
    const curR = Math.round(28 + t * 10);
    const curG = Math.round(25 + t * 10);
    const curB = Math.round(23 + t * 10);

    // Golden emblem
    if (dist < 0.75) {
      if (dist > 0.68 && dist < 0.74) {
        return [217, 119, 6, 255]; // Amber-600 gold border
      }
      if (dist <= 0.68) {
        const nx = (x - cx) / (r * 0.6);
        const ny = (y - cy) / (r * 0.6);
        const inLeftBar = nx >= -0.55 && nx <= -0.25 && ny >= -0.6 && ny <= 0.6;
        const inRightBar = nx >= 0.25 && nx <= 0.55 && ny >= -0.6 && ny <= 0.6;
        const inCrossBar = nx >= -0.55 && nx <= 0.55 && ny >= -0.15 && ny <= 0.15;
        const inRoof = ny < -0.4 && Math.abs(nx) < (0.6 - (ny + 0.6) * 0.8);

        if (inLeftBar || inRightBar || inCrossBar || inRoof) {
          return [245, 158, 11, 255]; // Gold
        }
        return [41, 37, 36, 255];
      }
    }
    return [curR, curG, curB, 255];
  }
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

console.log('Generating PWA icons...');

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPng(192, 192, (x, y, w, h) => drawDamviewIcon(x, y, w, h, false)));
console.log('Created pwa-192x192.png');

fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPng(512, 512, (x, y, w, h) => drawDamviewIcon(x, y, w, h, false)));
console.log('Created pwa-512x512.png');

fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPng(512, 512, (x, y, w, h) => drawDamviewIcon(x, y, w, h, true)));
console.log('Created pwa-maskable-512x512.png');

fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180, (x, y, w, h) => drawDamviewIcon(x, y, w, h, false)));
console.log('Created apple-touch-icon.png');

fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPng(48, 48, (x, y, w, h) => drawDamviewIcon(x, y, w, h, false)));
console.log('Created favicon.ico');

console.log('Icon generation complete.');
