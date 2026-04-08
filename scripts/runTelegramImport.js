#!/usr/bin/env node
'use strict';

const { runTelegramImport } = require('../src/lib/telegramImport');

const result = runTelegramImport();
console.log('Import complete');
console.log(JSON.stringify(result, null, 2));
