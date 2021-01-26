'use strict';
const fs = require('fs');
const path = require('path');

const FRAMEWORKS = {
  knex: { table: 'knex_migrations', lockfile: null },
  sequelize: { table: 'SequelizeMeta', lockfile: null },
  prisma: { table: '_prisma_migrations', lockfile: 'prisma/migrations/migration_lock.toml' },
  typeorm: { table: 'migrations', lockfile: null },
  custom: { table: 'migrations', lockfile: '.migrations.json' }
};

function readLockfile(dir, framework, tableName) {
  const config = FRAMEWORKS[framework] || FRAMEWORKS.custom;
  const lockPath = path.join(dir, '..', config.lockfile || '.migrations.json');
  if (!fs.existsSync(lockPath)) return [];
  try {
    const content = fs.readFileSync(lockPath, 'utf8');
    if (lockPath.endsWith('.json')) {
      const data = JSON.parse(content);
      if (Array.isArray(data)) return data.map(entry => typeof entry === 'string' ? { name: entry, date: null } : entry);
      if (data.migrations) return data.migrations;
      return [];
    }
    if (lockPath.endsWith('.toml')) {
      return content.split('\n').filter(l => l.includes('migration_name')).map(l => ({ name: l.split('=')[1].trim().replace(/"/g, ''), date: null }));
    }
    return [];
  } catch { return []; }
}

module.exports = { readLockfile, FRAMEWORKS };
