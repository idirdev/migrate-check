'use strict';
const fs = require('fs');
const path = require('path');

const MIGRATION_PATTERNS = {
  knex: /^(\d{14})_(.+)\.(js|ts)$/,
  sequelize: /^(\d{14})-(.+)\.(js|ts)$/,
  prisma: /^(\d{14})_(.+)\.sql$/,
  typeorm: /^(\d{13})-(.+)\.(js|ts)$/,
  custom: /^(\d+)[-_](.+)\.(js|ts|sql)$/
};

function scanDirectory(dir, framework = 'custom') {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ['.js', '.ts', '.sql'].includes(ext) && !f.startsWith('.');
  });
  return files.sort();
}

function parseFilename(filename, framework = 'custom') {
  const pattern = MIGRATION_PATTERNS[framework] || MIGRATION_PATTERNS.custom;
  const match = filename.match(pattern);
  if (match) {
    return { timestamp: match[1], name: match[2] || filename, raw: filename };
  }
  const name = path.basename(filename, path.extname(filename));
  return { timestamp: null, name, raw: filename };
}

function sortMigrations(migrations) {
  return migrations.sort((a, b) => {
    if (a.timestamp && b.timestamp) return a.timestamp.localeCompare(b.timestamp);
    return a.name.localeCompare(b.name);
  });
}

module.exports = { scanDirectory, parseFilename, sortMigrations, MIGRATION_PATTERNS };
