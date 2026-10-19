import fs from 'fs';
import path from 'path';

// Ensure public directory exists
const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Generate SVG Favicon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#32323a" />
      <stop offset="50%" stop-color="#18181c" />
      <stop offset="100%" stop-color="#08080a" />
    </linearGradient>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(255, 255, 255, 0.28)" />
      <stop offset="100%" stop-color="rgba(255, 255, 255, 0.05)" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.3" />
    </filter>
  </defs>
  <!-- Background Rounded Square -->
  <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#bgGrad)" stroke="url(#borderGrad)" stroke-width="1.5" />
  <!-- AR Monogram Text -->
  <text x="32" y="43" font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="900" letter-spacing="-1.5" fill="#FFFFFF" text-anchor="middle" filter="url(#shadow)">AR</text>
</svg>
`;

fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgContent, 'utf-8');
console.log('Created public/favicon.svg');

// 2. Generate multi-resolution ICO file (32x32 & 16x16)
function createIcoBuffer() {
  // Bitmap fonts for A and R at 32x32 (height 16, width 10 each, placed at y=8)
  const fontA_32 = [
    "  ####    ",
    " ######   ",
    " ##  ##   ",
    " ##  ##   ",
    "##    ##  ",
    "##    ##  ",
    "##    ##  ",
    "########  ",
    "########  ",
    "##    ##  ",
    "##    ##  ",
    "##    ##  ",
    "##    ##  ",
    "##    ##  ",
    "##    ##  ",
    "##    ##  "
  ];

  const fontR_32 = [
    "#######   ",
    "########  ",
    "##    ##  ",
    "##    ##  ",
    "##    ##  ",
    "########  ",
    "#######   ",
    "######    ",
    "##  ##    ",
    "##   ##   ",
    "##   ##   ",
    "##    ##  ",
    "##    ##  ",
    "##    ##  ",
    "##     ## ",
    "##     ## "
  ];

  // Bitmap fonts for A and R at 16x16 (height 9, width 5 each, placed at y=4)
  const fontA_16 = [
    " ### ",
    "## ##",
    "## ##",
    "## ##",
    "#####",
    "#####",
    "## ##",
    "## ##",
    "## ##"
  ];

  const fontR_16 = [
    "#### ",
    "## ##",
    "## ##",
    "#### ",
    "#### ",
    "## ##",
    "## ##",
    "## ##",
    "## ##"
  ];

  function renderImage(size, fontA, fontR, startY, startX_A, startX_R) {
    const pixels = new Uint8Array(size * size * 4); // RGBA
    const radius = size === 32 ? 6.5 : 3.5;
    const margin = size === 32 ? 1.5 : 0.8;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;

        // Check rounded box
        const cx = Math.max(0, Math.abs(x + 0.5 - size / 2) - (size / 2 - radius - margin));
        const cy = Math.max(0, Math.abs(y + 0.5 - size / 2) - (size / 2 - radius - margin));
        const dist = Math.sqrt(cx * cx + cy * cy);

        if (dist > radius) {
          // Transparent
          pixels[idx] = 0;
          pixels[idx + 1] = 0;
          pixels[idx + 2] = 0;
          pixels[idx + 3] = 0;
          continue;
        }

        // Gradient: Hitam Abu (#383842) ke Hitam Pekat (#0a0a0c)
        const t = (x + y) / (size * 2);
        let r = Math.round(56 * (1 - t) + 10 * t);
        let g = Math.round(56 * (1 - t) + 10 * t);
        let b = Math.round(66 * (1 - t) + 12 * t);
        let a = 255;

        // Anti-aliasing at the border
        if (dist > radius - 1) {
          a = Math.round(255 * (radius - dist));
        }

        // Check text overlay
        let isText = false;
        const fontH = fontA.length;

        // Check A
        if (y >= startY && y < startY + fontH) {
          const row = y - startY;
          const colA = x - startX_A;
          if (colA >= 0 && colA < fontA[row].length && fontA[row][colA] === '#') {
            isText = true;
          }

          const colR = x - startX_R;
          if (colR >= 0 && colR < fontR[row].length && fontR[row][colR] === '#') {
            isText = true;
          }
        }

        if (isText) {
          pixels[idx] = 255;
          pixels[idx + 1] = 255;
          pixels[idx + 2] = 255;
          pixels[idx + 3] = 255;
        } else {
          pixels[idx] = r;
          pixels[idx + 1] = g;
          pixels[idx + 2] = b;
          pixels[idx + 3] = a;
        }
      }
    }
    return pixels;
  }

  const img32 = renderImage(32, fontA_32, fontR_32, 8, 5, 17);
  const img16 = renderImage(16, fontA_16, fontR_16, 4, 2, 9);

  function createBmpData(size, rgba) {
    const headerSize = 40;
    const pixelDataSize = size * size * 4;
    const maskRowSize = Math.floor((size + 31) / 32) * 4;
    const maskSize = maskRowSize * size;
    const totalSize = headerSize + pixelDataSize + maskSize;

    const buf = Buffer.alloc(totalSize);
    // BITMAPINFOHEADER
    buf.writeUInt32LE(headerSize, 0); // biSize
    buf.writeInt32LE(size, 4); // biWidth
    buf.writeInt32LE(size * 2, 8); // biHeight (image + mask)
    buf.writeUInt16LE(1, 12); // biPlanes
    buf.writeUInt16LE(32, 14); // biBitCount
    buf.writeUInt32LE(0, 16); // biCompression (BI_RGB)
    buf.writeUInt32LE(pixelDataSize + maskSize, 20); // biSizeImage
    buf.writeInt32LE(0, 24); // biXPelsPerMeter
    buf.writeInt32LE(0, 28); // biYPelsPerMeter
    buf.writeUInt32LE(0, 32); // biClrUsed
    buf.writeUInt32LE(0, 36); // biClrImportant

    // Pixel data (bottom-up BGRA)
    let offset = 40;
    for (let y = size - 1; y >= 0; y--) {
      for (let x = 0; x < size; x++) {
        const srcIdx = (y * size + x) * 4;
        const r = rgba[srcIdx];
        const g = rgba[srcIdx + 1];
        const b = rgba[srcIdx + 2];
        const a = rgba[srcIdx + 3];

        buf[offset++] = b;
        buf[offset++] = g;
        buf[offset++] = r;
        buf[offset++] = a;
      }
    }

    // AND mask (all zeros since alpha channel handles transparency)
    buf.fill(0, offset, offset + maskSize);

    return buf;
  }

  const bmp32 = createBmpData(32, img32);
  const bmp16 = createBmpData(16, img16);

  // ICONDIR header
  const numImages = 2;
  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0); // Reserved
  icoHeader.writeUInt16LE(1, 2); // Type 1 = ICO
  icoHeader.writeUInt16LE(numImages, 4); // Count

  // ICONDIRENTRY for 32x32
  const entry32 = Buffer.alloc(16);
  entry32.writeUInt8(32, 0); // width
  entry32.writeUInt8(32, 1); // height
  entry32.writeUInt8(0, 2); // color count
  entry32.writeUInt8(0, 3); // reserved
  entry32.writeUInt16LE(1, 4); // planes
  entry32.writeUInt16LE(32, 6); // bit count
  entry32.writeUInt32LE(bmp32.length, 8); // bytes in res
  const offset32 = 6 + 16 * numImages;
  entry32.writeUInt32LE(offset32, 12); // image offset

  // ICONDIRENTRY for 16x16
  const entry16 = Buffer.alloc(16);
  entry16.writeUInt8(16, 0); // width
  entry16.writeUInt8(16, 1); // height
  entry16.writeUInt8(0, 2); // color count
  entry16.writeUInt8(0, 3); // reserved
  entry16.writeUInt16LE(1, 4); // planes
  entry16.writeUInt16LE(32, 6); // bit count
  entry16.writeUInt32LE(bmp16.length, 8); // bytes in res
  const offset16 = offset32 + bmp32.length;
  entry16.writeUInt32LE(offset16, 12); // image offset

  return Buffer.concat([icoHeader, entry32, entry16, bmp32, bmp16]);
}

const icoBuffer = createIcoBuffer();
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
console.log('Created public/favicon.ico (' + icoBuffer.length + ' bytes)');
