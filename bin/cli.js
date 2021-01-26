#!/usr/bin/env node
'use strict';

/**
 * @fileoverview CLI for migrate-check — inspect database migration status.
 * @author idirdev
 */

const path = require('path');
const { checkMigrations, formatReport } = require('../src/index.js');

const args = process.argv.slice(2);
let dir = process.cwd();
let framework = 'auto';
let pendingOnly = false;
let jsonOutput = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--framework' && args[i + 1]) { framework = args[++i]; }
  else if (args[i] === '--pending') { pendingOnly = true; }
  else if (args[i] === '--json') { jsonOutput = true; }
  else if (args[i] === '--help' || args[i] === '-h') {
    console.log('Usage: migrate-check [dir] [--framework auto|knex|sequelize|prisma] [--pending] [--json]');
    process.exit(0);
  } else if (!args[i].startsWith('--')) {
    dir = path.resolve(args[i]);
  }
}

const status = checkMigrations(dir, { framework });

if (pendingOnly) {
  if (jsonOutput) {
    console.log(JSON.stringify(status.pendingFiles, null, 2));
  } else {
    status.pendingFiles.forEach(f => console.log(f));
    if (status.pendingFiles.length === 0) console.log('No pending migrations.');
  }
  process.exit(status.pending > 0 ? 1 : 0);
}

if (jsonOutput) {
  console.log(JSON.stringify(status, null, 2));
  process.exit(0);
}

console.log(formatReport(status));
process.exit(0);
