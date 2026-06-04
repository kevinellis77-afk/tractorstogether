#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const rawExportPath = path.join(repoRoot, 'data', 'result.json');
const enrichedPath = path.join(repoRoot, 'data', 'messages_enriched.json');
const deployDir = path.resolve(repoRoot, process.argv[2] || process.env.DEPLOY_DIR || 'dist');

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function resetDeployDir(directory) {
  fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(directory, { recursive: true });
}

if (!fs.existsSync(rawExportPath)) {
  console.error(`Missing raw Telegram export: ${path.relative(repoRoot, rawExportPath)}`);
  console.error('Place the Telegram export at data/result.json before building the deploy artifact.');
  process.exit(1);
}

const importResult = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'runTelegramImport.js')], {
  cwd: repoRoot,
  stdio: 'inherit'
});

if (importResult.status !== 0) {
  process.exit(importResult.status || 1);
}

if (!fs.existsSync(enrichedPath)) {
  console.error(`Import completed but did not create ${path.relative(repoRoot, enrichedPath)}`);
  process.exit(1);
}

resetDeployDir(deployDir);
copyFile(path.join(repoRoot, 'index.html'), path.join(deployDir, 'index.html'));
copyFile(path.join(repoRoot, 'TransferTracker.html'), path.join(deployDir, 'TransferTracker.html'));
copyFile(enrichedPath, path.join(deployDir, 'data', 'messages_enriched.json'));

console.log(`Deploy artifact ready in ${path.relative(repoRoot, deployDir) || deployDir}`);
console.log(`Copied ${path.relative(repoRoot, enrichedPath)} to ${path.relative(repoRoot, path.join(deployDir, 'data', 'messages_enriched.json'))}`);
