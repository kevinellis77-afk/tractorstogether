#!/usr/bin/env node
'use strict';

const { runTelegramImport } = require('../src/lib/telegramImport');

const stats = runTelegramImport();
console.log(`raw message count: ${stats.rawMessageCount}`);
console.log(`processable message count: ${stats.processableMessageCount}`);
console.log(`newly imported count: ${stats.newlyImportedCount}`);
console.log(`duplicates skipped: ${stats.duplicatesSkipped}`);
console.log(`sentiment breakdown: ${JSON.stringify(stats.sentimentBreakdown)}`);
