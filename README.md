# migrate-check

> **[EN]** Database migration status checker — inspect applied vs pending migrations for Knex, Sequelize, Prisma, TypeORM or custom setups from the CLI or programmatically.
> **[FR]** Vérificateur de statut des migrations de base de données — inspectez les migrations appliquées vs en attente pour Knex, Sequelize, Prisma, TypeORM ou des configurations personnalisées depuis le CLI ou par programmation.

---

## Features / Fonctionnalités

**[EN]**
- Auto-detects migration framework by scanning for knexfile, prisma schema, .sequelizerc or ormconfig
- Lists all migration files with applied / pending / failed status and date applied
- Filter output to show only `--pending` or `--failed` migrations
- Table output with color-coded status badges, or raw JSON for CI
- Exits with code 1 if pending migrations exist, code 2 on failures
- Supports custom migrations table name via `--table`
- Reads `DATABASE_URL` or accepts explicit `--connection` string
- Works alongside your existing migration toolchain — read-only, never runs migrations

**[FR]**
- Détecte automatiquement le framework de migration en cherchant knexfile, schéma prisma, .sequelizerc ou ormconfig
- Liste tous les fichiers de migration avec le statut appliqué / en attente / échoué et la date d'application
- Filtrer la sortie pour afficher uniquement les migrations `--pending` ou `--failed`
- Sortie en tableau avec badges de statut colorés, ou JSON brut pour le CI
- Quitte avec le code 1 si des migrations sont en attente, code 2 en cas d'échecs
- Supporte le nom de table des migrations personnalisé via `--table`
- Lit `DATABASE_URL` ou accepte une chaîne `--connection` explicite
- Fonctionne avec votre chaîne d'outils de migration existante — lecture seule, ne lance jamais les migrations

---

## Installation

```bash
npm install -g @idirdev/migrate-check
```

---

## CLI Usage / Utilisation CLI

```bash
# Check migrations in ./migrations (auto-detect framework)
migrate-check

# Specify migrations directory / Spécifier le répertoire des migrations
migrate-check --dir ./db/migrations

# Force a specific framework / Forcer un framework spécifique
migrate-check --framework knex --dir ./migrations

# Show only pending migrations / Afficher uniquement les migrations en attente
migrate-check --pending

# Show only failed migrations / Afficher uniquement les migrations échouées
migrate-check --failed

# JSON output for CI / Sortie JSON pour le CI
migrate-check --format json

# Custom table name / Nom de table personnalisé
migrate-check --table schema_migrations

# With explicit connection / Avec connexion explicite
migrate-check --connection postgres://user:pass@localhost/mydb
```

### Example Output / Exemple de sortie

```
Migration Status Report
Framework: knex
Directory: /app/migrations

┌───┬──────────────────────────────────────┬─────────┬────────────┐
│ # │ Migration                            │ Status  │ Date       │
├───┼──────────────────────────────────────┼─────────┼────────────┤
│ 1 │ 20260101_create_users                │ applied │ 2026-01-01 │
│ 2 │ 20260115_add_roles                   │ applied │ 2026-01-15 │
│ 3 │ 20260201_create_sessions             │ applied │ 2026-02-01 │
│ 4 │ 20260310_add_refresh_tokens          │ pending │ -          │
└───┴──────────────────────────────────────┴─────────┴────────────┘

3 applied, 1 pending, 4 total
```

---

## API (Programmatic) / API (Programmation)

```js
const { checkMigrations, detectFramework } = require('@idirdev/migrate-check');

// Auto-detect and check / Détecter automatiquement et vérifier
const report = await checkMigrations({
  dir: './migrations',
  connection: process.env.DATABASE_URL,
});

console.log(report.framework);  // 'knex'
console.log(report.summary);    // { total: 4, applied: 3, pending: 1 }

report.migrations.forEach(m => {
  console.log(m.name, m.status, m.date || 'not yet applied');
});

// Check for pending before deploying / Vérifier les migrations en attente avant de déployer
if (report.summary.pending > 0) {
  console.error(report.summary.pending + ' pending migration(s) — run migrations first');
  process.exit(1);
}

// Detect framework only / Détecter uniquement le framework
const fw = detectFramework('./migrations');
console.log(fw); // 'knex' | 'sequelize' | 'prisma' | 'typeorm' | 'custom'
```

---

## License

MIT — idirdev
