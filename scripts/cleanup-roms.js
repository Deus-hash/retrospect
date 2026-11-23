const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROM_DIRS = [
  { name: 'NES', dir: path.join(__dirname, '..', 'public', 'roms', 'nes') },
  { name: 'Mega Drive', dir: path.join(__dirname, '..', 'public', 'roms', 'megadrive') },
];

const RE_GOOD = /\[!\]/;
const RE_BAD = /\[b[^\]]*\]/i;
const RE_HACK = /\[h[^\]]*\]/i;
const RE_PIRATE = /\[p[^\]]*\]/i;
const RE_OVERDUMP = /\[o[^\]]*\]/i;
const RE_FIX = /\[f[^\]]*\]/i;
const RE_TRANS = /\[T[+-][^\]]*\]/i;
const RE_TRANS_ENG = /\[T\+Eng[^\]]*\]/i;
const RE_ANY_TAG = /\[[^\]]*\]/;

function getBaseName(filename) {
  const name = filename.replace(/\.[^/.]+$/, '');
  const idx = name.indexOf('(');
  return idx === -1 ? name.trim() : name.substring(0, idx).trim();
}

function getDeletionReason(filename) {
  if (RE_HACK.test(filename)) return 'Hack [h*]';
  if (RE_PIRATE.test(filename)) return 'Pirate/unlicensed [p*]';
  if (RE_OVERDUMP.test(filename)) return 'Overdump [o*]';
  if (RE_FIX.test(filename)) return 'Homebrew/fix [f*]';
  if (RE_TRANS.test(filename) && !RE_TRANS_ENG.test(filename)) return 'Non-English translation [T+*]/[T-*]';
  if (RE_BAD.test(filename)) return 'Bad dump [b*]';
  return 'Variant/alternate version';
}

function selectBest(files) {
  const good = files.filter(f => RE_GOOD.test(f));
  if (good.length) return good.sort()[0];

  const noTag = files.filter(f => !RE_ANY_TAG.test(f));
  if (noTag.length) return noTag.sort()[0];

  const engTrans = files.filter(f => RE_TRANS_ENG.test(f));
  if (engTrans.length) return engTrans.sort()[0];

  const bad = files.filter(f => RE_BAD.test(f));
  if (bad.length) return bad.sort()[0];

  return files.sort()[0];
}

function analyze(dirPath) {
  const stats = { before: 0, deleted: 0, deletions: [] };

  if (!fs.existsSync(dirPath)) {
    return stats;
  }

  const files = fs.readdirSync(dirPath).filter(f =>
    fs.statSync(path.join(dirPath, f)).isFile()
  );
  stats.before = files.length;

  const groups = {};
  for (const file of files) {
    const base = getBaseName(file);
    if (!groups[base]) groups[base] = [];
    groups[base].push(file);
  }

  for (const group of Object.values(groups)) {
    if (group.length <= 1) continue;

    const keep = selectBest(group);

    for (const file of group) {
      if (file === keep) continue;
      stats.deletions.push({ file, reason: getDeletionReason(file) });
    }
  }

  stats.deleted = stats.deletions.length;
  return stats;
}

async function main() {
  console.log('=== RetroPet ROM Cleanup ===\n');

  const results = {};
  let totalBefore = 0;
  let totalDelete = 0;
  const allDeletions = [];

  for (const { name, dir } of ROM_DIRS) {
    const stats = analyze(dir);
    results[name] = stats;
    totalBefore += stats.before;
    totalDelete += stats.deleted;

    for (const d of stats.deletions) {
      allDeletions.push({ ...d, dir: name });
    }

    console.log(`${name}:`);
    console.log(`  Directory: ${dir}`);
    console.log(`  Total files: ${stats.before}`);
    console.log(`  Files to delete: ${stats.deleted}`);
    console.log(`  Files to keep: ${stats.before - stats.deleted}`);
    console.log();
  }

  console.log('Summary:');
  console.log(`  Total ROM files: ${totalBefore}`);
  console.log(`  Files to delete: ${totalDelete}`);
  console.log(`  Files to keep: ${totalBefore - totalDelete}`);
  console.log();

  if (allDeletions.length === 0) {
    console.log('No files to delete. Nothing to do.');
    return;
  }

  console.log('Files to be deleted:');
  for (const d of allDeletions) {
    console.log(`  [${d.dir}] ${d.file} — ${d.reason}`);
  }
  console.log();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise(resolve => {
    rl.question('Proceed with deletion? (Y/n): ', resolve);
  });
  rl.close();

  if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes' && answer !== '') {
    console.log('Cleanup cancelled.');
    return;
  }

  console.log('\nDeleting files...\n');
  let actualDeleted = 0;

  for (const { name, dir } of ROM_DIRS) {
    const stats = results[name];
    for (const { file, reason } of stats.deletions) {
      fs.unlinkSync(path.join(dir, file));
      actualDeleted++;
      console.log(`Deleted: ${file}`);
      console.log(`  Reason: ${reason}\n`);
    }
  }

  console.log('=== Cleanup Complete ===');
  for (const { name, dir } of ROM_DIRS) {
    const remaining = fs.readdirSync(dir).filter(f =>
      fs.statSync(path.join(dir, f)).isFile()
    ).length;
    const was = results[name].before;
    console.log(`${name}: ${was} → ${remaining} files (${was - remaining} deleted)`);
  }
}

main().catch(console.error);
