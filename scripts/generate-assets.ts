import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const publicDir = path.resolve(process.cwd(), 'public');
const seedDir = path.resolve(publicDir, 'seed');
const iconsDir = path.resolve(publicDir, 'icons');

if (!fs.existsSync(seedDir)) fs.mkdirSync(seedDir, { recursive: true });
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

function makeAvatarSvg(label: string, bg1: string, bg2: string, fg: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg1}" />
      <stop offset="100%" stop-color="${bg2}" />
    </linearGradient>
  </defs>
  <circle cx="60" cy="60" r="60" fill="url(#g)" />
  <circle cx="60" cy="60" r="54" fill="none" stroke="${fg}" stroke-width="2" opacity="0.4" stroke-dasharray="4 4" />
  <text x="60" y="68" fill="${fg}" font-family="Cairo, sans-serif" font-size="36" font-weight="bold" text-anchor="middle" dominant-baseline="central">${label}</text>
</svg>`;
}

function makeCoverSvg(title: string, sub: string, bg1: string, bg2: string, fg: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" width="1200" height="400">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg1}" />
      <stop offset="100%" stop-color="${bg2}" />
    </linearGradient>
  </defs>
  <rect width="1200" height="400" fill="url(#bg)" />
  <g opacity="0.15" stroke="${fg}" stroke-width="2" fill="none">
    <path d="M0 200 Q300 100 600 200 T1200 200" />
    <path d="M0 240 Q300 140 600 240 T1200 240" />
    <path d="M0 280 Q300 180 600 280 T1200 280" />
    <circle cx="600" cy="200" r="160" />
    <circle cx="600" cy="200" r="240" />
  </g>
  <text x="600" y="180" fill="${fg}" font-family="Cairo, sans-serif" font-size="48" font-weight="bold" text-anchor="middle">${title}</text>
  <text x="600" y="240" fill="${fg}" opacity="0.85" font-family="Cairo, sans-serif" font-size="22" font-weight="600" text-anchor="middle">${sub}</text>
</svg>`;
}

function makeProductSvg(title: string, tag: string, bg1: string, bg2: string, fg: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg1}" />
      <stop offset="100%" stop-color="${bg2}" />
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#bg)" />
  <rect x="40" y="40" width="520" height="520" rx="32" fill="none" stroke="${fg}" stroke-width="4" opacity="0.25" />
  <circle cx="300" cy="270" r="140" fill="none" stroke="${fg}" stroke-width="6" opacity="0.3" stroke-dasharray="12 8" />
  <g transform="translate(300, 270) scale(4)">
    <path d="M-5.5 -19 L5.5 -19 L1.6 -9.5 L1.6 -2 L-1.6 -2 L-1.6 -9.5 Z" fill="${fg}" />
    <path d="M-5.5 -19 L5.5 -19 L1.6 -9.5 L1.6 -2 L-1.6 -2 L-1.6 -9.5 Z" fill="${fg}" transform="rotate(120)" />
    <path d="M-5.5 -19 L5.5 -19 L1.6 -9.5 L1.6 -2 L-1.6 -2 L-1.6 -9.5 Z" fill="${fg}" opacity="0.7" transform="rotate(240)" />
  </g>
  <text x="300" y="450" fill="${fg}" font-family="Cairo, sans-serif" font-size="28" font-weight="bold" text-anchor="middle">${title}</text>
  <text x="300" y="490" fill="${fg}" opacity="0.8" font-family="Cairo, sans-serif" font-size="20" font-weight="600" text-anchor="middle">${tag}</text>
</svg>`;
}

// Write seed avatars
fs.writeFileSync(path.join(seedDir, 'avatar-me.svg'), makeAvatarSvg('ع', '#0E7490', '#155E75', '#FFFFFF'));
fs.writeFileSync(path.join(seedDir, 'avatar-1.svg'), makeAvatarSvg('س', '#B45309', '#78350F', '#FFFFFF'));
fs.writeFileSync(path.join(seedDir, 'avatar-2.svg'), makeAvatarSvg('د', '#4338CA', '#312E81', '#FFFFFF'));
fs.writeFileSync(path.join(seedDir, 'avatar-3.svg'), makeAvatarSvg('ع', '#15803D', '#14532D', '#FFFFFF'));
fs.writeFileSync(path.join(seedDir, 'avatar-4.svg'), makeAvatarSvg('ن', '#BE123C', '#881337', '#FFFFFF'));

// Write covers
fs.writeFileSync(path.join(seedDir, 'cover-me.svg'), makeCoverSvg('علي الرافدين', 'مهندس ومصور معماري · بغداد 🇮🇶', '#0E7490', '#164E63', '#FFFFFF'));
fs.writeFileSync(path.join(seedDir, 'cover-dijlah.svg'), makeCoverSvg('دجلة الصباح', 'ضفاف النهر وشروق الشمس · بغداد', '#0284C7', '#0369A1', '#FFFFFF'));
fs.writeFileSync(path.join(seedDir, 'cover-palm.svg'), makeCoverSvg('نخيل البصرة', 'بساتين الفاو وشط العرب · البصرة', '#059669', '#065F46', '#FFFFFF'));
fs.writeFileSync(path.join(seedDir, 'cover-night.svg'), makeCoverSvg('بغداد ليلاً', 'جسر الصرافية وشارع أبي نواس', '#1E1B4B', '#0F172A', '#F1F5F9'));
fs.writeFileSync(path.join(seedDir, 'cover-poet.svg'), makeCoverSvg('مجلس المتنبي', 'شارع المتنبي ورائحة الكتب التراثية', '#78350F', '#451A03', '#FEF3C7'));
fs.writeFileSync(path.join(seedDir, 'cover-merchant.svg'), makeCoverSvg('سوق الصفافير', 'حرفيات النحاس والفضة البغدادية الأصيلة', '#9A3412', '#7C2D12', '#FFEDD5'));

// Write post media
fs.writeFileSync(path.join(seedDir, 'post-1.svg'), makeProductSvg('شناشيل البصرة العتيقة', 'توثيق معماري · العشار', '#1E3A8A', '#172554', '#E0E7FF'));
fs.writeFileSync(path.join(seedDir, 'post-2.svg'), makeProductSvg('صناعة النحاس اليدوي', 'سوق الصفافير · بغداد', '#7C2D12', '#431407', '#FED7AA'));
fs.writeFileSync(path.join(seedDir, 'post-3.svg'), makeProductSvg('قلعة أربيل التاريخية', 'كوردستان العراق', '#065F46', '#022C22', '#D1FAE5'));

// Write products
fs.writeFileSync(path.join(seedDir, 'prod-1.svg'), makeProductSvg('صينية نحاس بابلية', 'نحاس أحمر منقوش يدوياً · قطر 40 سم', '#9A3412', '#7C2D12', '#FFFFFF'));
fs.writeFileSync(path.join(seedDir, 'prod-2.svg'), makeProductSvg('تاريخ عمارة بغداد', 'طبعة فاخرة بغلاف قماشي مطرز', '#1E40AF', '#172554', '#FFFFFF'));
fs.writeFileSync(path.join(seedDir, 'prod-3.svg'), makeProductSvg('سجادة صوف كوردية', 'أصواف طبيعية بأصباغ نباتية · أربيل', '#831843', '#500724', '#FFFFFF'));
fs.writeFileSync(path.join(seedDir, 'prod-4.svg'), makeProductSvg('مسبحة كهرمان بلطيقي', 'خراطة يدوية ملمس ناعم وعطر طبيعي', '#A16207', '#713F12', '#FFFFFF'));

// Communities
fs.writeFileSync(path.join(seedDir, 'comm-1.svg'), makeAvatarSvg('💻', '#0E7490', '#155E75', '#FFFFFF'));
fs.writeFileSync(path.join(seedDir, 'comm-2.svg'), makeAvatarSvg('🏛️', '#B45309', '#78350F', '#FFFFFF'));
fs.writeFileSync(path.join(seedDir, 'comm-3.svg'), makeAvatarSvg('⚒️', '#4338CA', '#312E81', '#FFFFFF'));

console.log('Seed SVG assets created in public/seed/');

// Generate PNG icons using zlib raw chunks
function generatePurePng(width: number, height: number, r: number, g: number, b: number): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit depth
  ihdrData.writeUInt8(2, 9); // truecolor (RGB)
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace

  function makeChunk(type: string, data: Buffer): Buffer {
    const chunkLen = Buffer.alloc(4);
    chunkLen.writeUInt32BE(data.length, 0);
    const chunkType = Buffer.from(type);
    const body = Buffer.concat([chunkType, data]);

    let crc = 0xffffffff;
    for (let i = 0; i < body.length; i++) {
      crc ^= body[i]!;
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const chunkCrc = Buffer.alloc(4);
    chunkCrc.writeUInt32BE(crc, 0);

    return Buffer.concat([chunkLen, body, chunkCrc]);
  }

  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Raw pixel scanlines (filter 0 + RGB)
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter byte: None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 3;
      // Draw a subtle border circle
      const dx = x - width / 2;
      const dy = y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < width * 0.4) {
        rawData[pxOffset] = 14; // #0E7490
        rawData[pxOffset + 1] = 116;
        rawData[pxOffset + 2] = 144;
      } else {
        rawData[pxOffset] = r;
        rawData[pxOffset + 1] = g;
        rawData[pxOffset + 2] = b;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

fs.writeFileSync(path.join(iconsDir, 'icon-180.png'), generatePurePng(180, 180, 250, 249, 247));
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), generatePurePng(192, 192, 250, 249, 247));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), generatePurePng(512, 512, 250, 249, 247));
fs.writeFileSync(path.join(iconsDir, 'icon-512-maskable.png'), generatePurePng(512, 512, 14, 116, 144));

console.log('Icons generated successfully in public/icons/');
