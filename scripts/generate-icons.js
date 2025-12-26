import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const svgBuffer = readFileSync(join(rootDir, 'public/icon.svg'));

async function generateIcons() {
  try {
    // Générer icon-192x192.png
    await sharp(svgBuffer)
      .resize(192, 192)
      .png()
      .toFile(join(rootDir, 'public/icon-192x192.png'));
    
    console.log('✓ icon-192x192.png créé');

    // Générer icon-512x512.png
    await sharp(svgBuffer)
      .resize(512, 512)
      .png()
      .toFile(join(rootDir, 'public/icon-512x512.png'));
    
    console.log('✓ icon-512x512.png créé');

    // Générer apple-touch-icon.png (180x180 pour iOS)
    await sharp(svgBuffer)
      .resize(180, 180)
      .png()
      .toFile(join(rootDir, 'public/apple-touch-icon.png'));
    
    console.log('✓ apple-touch-icon.png créé');

    // Générer favicon.ico
    await sharp(svgBuffer)
      .resize(32, 32)
      .png()
      .toFile(join(rootDir, 'public/favicon.ico'));
    
    console.log('✓ favicon.ico créé');

    console.log('\n✅ Toutes les icônes ont été générées avec succès!');
  } catch (error) {
    console.error('Erreur lors de la génération des icônes:', error);
    process.exit(1);
  }
}

generateIcons();

