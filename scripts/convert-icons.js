import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Create icons at sizes: 16, 32, 48, 128
const sizes = [16, 32, 48, 128];

// Dark background color
const BG_COLOR = '#0a0a0a';

async function convert() {
  const publicIconsDir = join(rootDir, 'public', 'icons');
  const svgPath = join(rootDir, 'public', 'logo', 'aet.svg');

  // Read the source SVG
  const svgContent = readFileSync(svgPath, 'utf-8');

  for (const size of sizes) {
    const pngPath = join(publicIconsDir, `icon${size}.png`);

    // Logo should be slightly smaller than the icon (80% of size)
    const logoSize = Math.round(size * 0.7);
    const padding = Math.round((size - logoSize) / 2);

    // Create dark circular background
    const circleSvg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${BG_COLOR}"/>
      </svg>
    `;

    // Resize the logo
    const logoBuffer = await sharp(Buffer.from(svgContent))
      .resize(logoSize, logoSize)
      .png()
      .toBuffer();

    // Create background and composite logo on top
    await sharp(Buffer.from(circleSvg))
      .png()
      .composite([{
        input: logoBuffer,
        left: padding,
        top: padding,
      }])
      .toFile(pngPath);

    console.log(`Created icon${size}.png (${size}x${size})`);
  }

  console.log('All icons converted with dark background!');
}

convert().catch(console.error);
