'use strict';

/**
 * @fileoverview Tests for migrate-check.
 * @author idirdev
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  detectFramework,
  getMigrationFiles,
  parseMigrationName,
  compareWithDb,
  checkMigrations,
  formatReport,
  FRAMEWORKS,
} = require('../src/index.js');

/** Create a temp dir and return its path. */
function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-check-test-'));
}

/** Write a file relative to base dir, creating dirs as needed. */
function touch(base, rel, content = '') {
  const full = path.join(base, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

test('FRAMEWORKS: all expected frameworks are defined', () => {
  const expected = ['sequelize', 'knex', 'prisma', 'typeorm', 'django', 'rails'];
  for (const fw of expected) {
    assert.ok(fw in FRAMEWORKS, 'Missing framework: ' + fw);
  }
});

test('detectFramework: knex detection via knexfile.js', () => {
  const dir = tmpDir();
  touch(dir, 'knexfile.js', 'module.exports = {};');
  const fw = detectFramework(dir);
  assert.equal(fw, 'knex');
});

test('detectFramework: prisma detection via prisma/schema.prisma', () => {
  const dir = tmpDir();
  touch(dir, 'prisma/schema.prisma', 'datasource db {}');
  const fw = detectFramework(dir);
  assert.equal(fw, 'prisma');
});

test('detectFramework: sequelize detection via .sequelizerc', () => {
  const dir = tmpDir();
  touch(dir, '.sequelizerc', '');
  const fw = detectFramework(dir);
  assert.equal(fw, 'sequelize');
});

test('detectFramework: returns unknown for empty dir', () => {
  const dir = tmpDir();
  assert.equal(detectFramework(dir), 'unknown');
});

test('getMigrationFiles: finds knex migration files', () => {
  const dir = tmpDir();
  touch(dir, 'migrations/20240101120000_create_users.js', '');
  touch(dir, 'migrations/20240102130000_add_email.js', '');
  touch(dir, 'migrations/not_a_migration.txt', '');
  const files = getMigrationFiles(dir, 'knex');
  assert.equal(files.length, 2);
  assert.ok(files[0].endsWith('20240101120000_create_users.js'));
});

test('getMigrationFiles: returns empty array for unknown framework', () => {
  const dir = tmpDir();
  const files = getMigrationFiles(dir, 'unknown');
  assert.deepEqual(files, []);
});

test('getMigrationFiles: returns empty array when migrations dir missing', () => {
  const dir = tmpDir();
  const files = getMigrationFiles(dir, 'knex');
  assert.deepEqual(files, []);
});

test('parseMigrationName: knex timestamp filename', () => {
  const result = parseMigrationName('20240101120000_create_users.js');
  assert.equal(result.timestamp, '20240101120000');
  assert.ok(result.name.includes('create'));
});

test('parseMigrationName: sequelize sequence filename', () => {
  const result = parseMigrationName('001-create-users.js');
  assert.equal(result.sequence, 1);
});

test('parseMigrationName: rails timestamp filename', () => {
  const result = parseMigrationName('20240315090000_add_index.rb');
  assert.equal(result.timestamp, '20240315090000');
  assert.ok(result.name.includes('add'));
});

test('parseMigrationName: fallback for unrecognized pattern', () => {
  const result = parseMigrationName('randomfile.js');
  assert.ok(typeof result.name === 'string');
});

test('compareWithDb: identifies pending migrations', () => {
  const files = [
    '/migrations/20240101_a.js',
    '/migrations/20240102_b.js',
    '/migrations/20240103_c.js',
  ];
  const applied = ['20240101_a.js', '20240102_b.js'];
  const result = compareWithDb(files, applied);
  assert.equal(result.pending.length, 1);
  assert.ok(result.pending[0].includes('20240103_c.js'));
  assert.equal(result.applied.length, 2);
});

test('compareWithDb: all applied returns no pending', () => {
  const files = ['/migrations/20240101_a.js'];
  const result = compareWithDb(files, ['20240101_a.js']);
  assert.equal(result.pending.length, 0);
  assert.equal(result.applied.length, 1);
});

test('checkMigrations: full check on knex project', () => {
  const dir = tmpDir();
  touch(dir, 'knexfile.js', '');
  touch(dir, 'migrations/20240101120000_first.js', '');
  touch(dir, 'migrations/20240202130000_second.js', '');
  const result = checkMigrations(dir, { applied: ['20240101120000_first.js'] });
  assert.equal(result.framework, 'knex');
  assert.equal(result.total, 2);
  assert.equal(result.applied, 1);
  assert.equal(result.pending, 1);
});

test('formatReport: returns string with expected sections', () => {
  const status = {
    framework: 'knex', total: 3, applied: 2,
    pending: 1, failed: 0, lastApplied: '20240202_second.js',
  };
  const report = formatReport(status);
  assert.ok(report.includes('knex'));
  assert.ok(report.includes('3'));
  assert.ok(report.includes('20240202_second.js'));
});
