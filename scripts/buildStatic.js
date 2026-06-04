#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const shouldSkipImport = args.includes('--skip-import') || args.includes('--no-import');
const outputArg = args.find((arg) => !arg.startsWith('--'));
const distDir = path.resolve(repoRoot, outputArg || process.env.DEPLOY_DIR || 'dist');

const staticFiles = ['index.html', 'TransferTracker.html'];
const runtimeDataFiles = ['messages_enriched.json'];
const rawTelegramExports = new Set(['result.json']);

function relative(filePath) {
  return path.relative(repoRoot, filePath) || '.';
}

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  console.log(`Copied ${relative(source)} -> ${relative(destination)}`);
}

function requireSource(filePath, description) {
  if (!fs.existsSync(filePath)) {
    console.error(`Missing ${description}: ${relative(filePath)}`);
    process.exit(1);
  }
}

function runImportIfPossible() {
  const rawExportPath = path.join(repoRoot, 'data', 'result.json');

  if (shouldSkipImport) {
    console.log('Skipping Telegram import because --skip-import/--no-import was provided.');
    return;
  }

  if (!fs.existsSync(rawExportPath)) {
    console.log('No data/result.json found; using the existing runtime data files.');
    return;
  }

  console.log('Found data/result.json; refreshing data/messages_enriched.json before building.');
  const importResult = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'runTelegramImport.js')], {
    cwd: repoRoot,
    stdio: 'inherit'
  });

  if (importResult.status !== 0) {
    process.exit(importResult.status || 1);
  }
}

function resetDist() {
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });
}

runImportIfPossible();
resetDist();

for (const fileName of staticFiles) {
  const source = path.join(repoRoot, fileName);
  requireSource(source, 'static file');
  copyFile(source, path.join(distDir, fileName));
}

for (const fileName of runtimeDataFiles) {
  if (rawTelegramExports.has(fileName)) {
    continue;
  }

  const source = path.join(repoRoot, 'data', fileName);
  requireSource(source, 'runtime data file');
  copyFile(source, path.join(distDir, 'data', fileName));
}

console.log(`Static deploy folder ready: ${relative(distDir)}`);
console.log('Raw Telegram exports such as result.json and data/result.json are not copied.');
