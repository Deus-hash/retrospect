/**
 * Script to extract ROM files from 7z archives for the emulator.
 * Usage: node scripts/extract-roms.js
 *
 * Looks for 7z files in the existing game collection folders
 * and extracts them to public/roms/nes/ and public/roms/megadrive/
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_DIR = path.resolve(__dirname, '..');
const NES_SRC = path.join(BASE_DIR, 'NES (Dendy) Games A-L');
const NES_SRC2 = path.join(BASE_DIR, 'NES (Dendy) Games M-Z');
const MD_SRC = path.join(BASE_DIR, '1034 игры для Sega MD');
const NES_DEST = path.join(BASE_DIR, 'public', 'roms', 'nes');
const MD_DEST = path.join(BASE_DIR, 'public', 'roms', 'megadrive');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function extractFrom(sourceDir, destDir) {
  if (!fs.existsSync(sourceDir)) {
    console.log(`Source directory not found: ${sourceDir}`);
    return;
  }

  const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.7z'));
  console.log(`Found ${files.length} archives in ${sourceDir}`);

  ensureDir(destDir);

  for (const file of files) {
    const srcPath = path.join(sourceDir, file);
    const name = file.replace(/\.7z$/, '');
    console.log(`  Extracting: ${file}`);

    try {
      execSync(`"${get7zPath()}" x "${srcPath}" -o"${destDir}" -y -aoa`, {
        stdio: 'pipe',
        timeout: 30000,
      });
      console.log(`    Done: ${name}`);
    } catch (err) {
      console.log(`    Skip: ${file} — extraction error or not a ROM`);
    }
  }
}

function get7zPath() {
  const candidates = [
    'C:\\Program Files\\7-Zip\\7z.exe',
    'C:\\Program Files (x86)\\7-Zip\\7z.exe',
    '7z',
  ];
  for (const c of candidates) {
    try {
      execSync(`"${c}"`, { stdio: 'pipe' });
      return c;
    } catch {
      continue;
    }
  }
  return '7z';
}

console.log('=== RetroPet ROM Extractor ===\n');

extractFrom(NES_SRC, NES_DEST);
extractFrom(NES_SRC2, NES_DEST);
extractFrom(MD_SRC, MD_DEST);

console.log('\n=== Extraction complete ===');
console.log(`NES ROMs: ${fs.readdirSync(NES_DEST).length} files`);
console.log(`MD ROMs: ${fs.readdirSync(MD_DEST).length} files`);
