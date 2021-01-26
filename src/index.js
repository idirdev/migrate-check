'use strict';

/**
 * @fileoverview Database migration status checker for multiple frameworks.
 * @module migrate-check
 * @author idirdev
 */

const fs = require('fs');
const path = require('path');

/**
 * Framework detection configuration.
 * Each entry defines config file patterns, migration directory patterns,
 * and filename regex for parsing migration names.
 *
 * @readonly
 * @type {Record<string, { configs: string[], dirs: string[], pattern: RegExp }>}
 */
const FRAMEWORKS = {
  sequelize: {
    configs: ['.sequelizerc', 'sequelize.config.js', 'sequelize.config.cjs'],
    dirs: ['migrations', 'db/migrations'],
    pattern: /^(\d+)-(.+)\.(js|cjs|mjs)$/,
  },
  knex: {
    configs: ['knexfile.js', 'knexfile.ts', 'knexfile.cjs'],
    dirs: ['migrations', 'db/migrations', 'database/migrations'],
    pattern: /^(\d{14})_(\S+)\.(js|ts)$/,
  },
  prisma: {
    configs: ['prisma/schema.prisma', 'schema.prisma'],
    dirs: ['prisma/migrations'],
    pattern: /^(\d{14})_(.+)$/,
  },
  typeorm: {
    configs: ['ormconfig.js', 'ormconfig.json', 'ormconfig.ts', 'data-source.ts'],
    dirs: ['migrations', 'src/migrations', 'database/migrations'],
    pattern: /^(\d{13})-(.+)\.(js|ts)$/,
  },
  django: {
    configs: ['manage.py', 'settings.py'],
    dirs: ['migrations', '*/migrations'],
    pattern: /^(\d{4})_(.+)\.py$/,
  },
  rails: {
    configs: ['Gemfile', 'config/database.yml'],
    dirs: ['db/migrate'],
    pattern: /^(\d{14})_(.+)\.rb$/,
  },
};

/**
 * Auto-detect the migration framework used in the given project directory.
 * @param {string} dir - Path to project root.
 * @returns {string} Detected framework name, or 'unknown' if not detected.
 */
function detectFramework(dir) {
  for (const [name, config] of Object.entries(FRAMEWORKS)) {
    for (const cf of config.configs) {
      const full = path.join(dir, cf);
      if (fs.existsSync(full)) return name;
    }
  }
  return 'unknown';
}

/**
 * Find migration files in a directory using a framework's expected dirs and pattern.
 * @param {string} dir - Project root directory.
 * @param {string} framework - Framework name (key in FRAMEWORKS).
 * @returns {string[]} Sorted list of migration file paths.
 */
function getMigrationFiles(dir, framework) {
  const config = FRAMEWORKS[framework];
  if (!config) return [];

  for (const migDir of config.dirs) {
    const full = path.join(dir, migDir);
    if (!fs.existsSync(full)) continue;
    try {
      const entries = fs.readdirSync(full);
      return entries
        .filter(f => config.pattern.test(f))
        .sort()
        .map(f => path.join(full, f));
    } catch (_) {
      continue;
    }
  }
  return [];
}

/**
 * Parse a migration filename to extract its timestamp, name, and sequence.
 * @param {string} filename - Basename of the migration file.
 * @returns {{ timestamp: string|null, name: string, sequence: number|null }} Parsed info.
 */
function parseMigrationName(filename) {
  const base = path.basename(filename);

  // Try each framework pattern
  for (const config of Object.values(FRAMEWORKS)) {
    const m = base.match(config.pattern);
    if (m) {
      const raw = m[1];
      const name = m[2] || '';
      const isNumericTs = /^\d{10,}$/.test(raw);
      const isSeq = /^\d{1,6}$/.test(raw);
      return {
        timestamp: isNumericTs ? raw : null,
        name: name.replace(/[_-]/g, ' ').trim(),
        sequence: isSeq ? parseInt(raw, 10) : null,
      };
    }
  }

  // Fallback: strip extension and return name
  const name = base.replace(/\.[^.]+$/, '').replace(/^[\d_-]+/, '');
  return { timestamp: null, name: name || base, sequence: null };
}

/**
 * Compare migration files with the set of applied migration names.
 * @param {string[]} files - Array of migration file paths.
 * @param {string[]} applied - Array of applied migration identifiers (names or timestamps).
 * @returns {{ pending: string[], applied: string[], failed: string[] }} Comparison result.
 */
function compareWithDb(files, applied) {
  const appliedSet = new Set(applied.map(a => a.toLowerCase()));
  const pending = [];
  const appliedFiles = [];
  const failed = [];

  for (const f of files) {
    const base = path.basename(f);
    const parsed = parseMigrationName(base);
    const key = (parsed.timestamp || parsed.name || base).toLowerCase();
    const nameKey = parsed.name.toLowerCase().replace(/\s+/g, '_');

    if (appliedSet.has(key) || appliedSet.has(base.toLowerCase()) || appliedSet.has(nameKey)) {
      appliedFiles.push(f);
    } else {
      pending.push(f);
    }
  }

  return { pending, applied: appliedFiles, failed };
}

/**
 * Get a summary status object for migrations in a project directory.
 * @param {string} dir - Project root directory.
 * @param {{ framework?: string, applied?: string[] }} [opts] - Options. 'applied' is a list of known-applied migration names.
 * @returns {{ framework: string, total: number, applied: number, pending: number, failed: number, lastApplied: string|null, files: string[] }} Status object.
 */
function getStatus(dir, opts = {}) {
  const framework = opts.framework && opts.framework !== 'auto'
    ? opts.framework
    : detectFramework(dir);

  const files = getMigrationFiles(dir, framework);
  const appliedNames = opts.applied || [];
  const comparison = compareWithDb(files, appliedNames);

  const lastApplied = comparison.applied.length > 0
    ? path.basename(comparison.applied[comparison.applied.length - 1])
    : null;

  return {
    framework,
    total: files.length,
    applied: comparison.applied.length,
    pending: comparison.pending.length,
    failed: comparison.failed.length,
    lastApplied,
    files,
  };
}

/**
 * Format a status object into a human-readable report string.
 * @param {{ framework: string, total: number, applied: number, pending: number, failed: number, lastApplied: string|null }} status - Status object from getStatus().
 * @returns {string} Formatted multi-line report.
 */
function formatReport(status) {
  const lines = [
    'Migration Status Report',
    '=======================',
    'Framework : ' + status.framework,
    'Total     : ' + status.total,
    'Applied   : ' + status.applied,
    'Pending   : ' + status.pending,
    'Failed    : ' + status.failed,
    'Last      : ' + (status.lastApplied || 'none'),
  ];
  if (status.pending > 0) {
    lines.push('');
    lines.push('Pending migrations:');
    (status.pendingFiles || []).forEach(f => lines.push('  - ' + path.basename(f)));
  }
  return lines.join('\n');
}

/**
 * Full migration check: detect framework, scan files, compare with applied list.
 * @param {string} dir - Project root directory.
 * @param {{ framework?: string, applied?: string[] }} [opts] - Options.
 * @returns {{ framework: string, total: number, applied: number, pending: number, failed: number, lastApplied: string|null, pendingFiles: string[], appliedFiles: string[] }} Full status.
 */
function checkMigrations(dir, opts = {}) {
  const framework = opts.framework && opts.framework !== 'auto'
    ? opts.framework
    : detectFramework(dir);

  const files = getMigrationFiles(dir, framework);
  const appliedNames = opts.applied || [];
  const comparison = compareWithDb(files, appliedNames);

  const lastApplied = comparison.applied.length > 0
    ? path.basename(comparison.applied[comparison.applied.length - 1])
    : null;

  return {
    framework,
    total: files.length,
    applied: comparison.applied.length,
    pending: comparison.pending.length,
    failed: comparison.failed.length,
    lastApplied,
    pendingFiles: comparison.pending,
    appliedFiles: comparison.applied,
  };
}

module.exports = {
  FRAMEWORKS,
  detectFramework,
  getMigrationFiles,
  parseMigrationName,
  compareWithDb,
  getStatus,
  checkMigrations,
  formatReport,
};
