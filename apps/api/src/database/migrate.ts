import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

export async function runMigrations(): Promise<void> {
  const connectionString =
    process.env.DATABASE_MIGRATOR_URL ||
    'postgresql://crm_migrator:local_migrator_secret@localhost:5432/crm_dev?schema=public';

  const client = new Client({ connectionString });
  await client.connect();
  console.log('🔗 Connected to PostgreSQL for schema migrations...');

  const migrationsDir = path.resolve(__dirname, '../../prisma/migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.warn(`Migrations directory not found at ${migrationsDir}`);
    await client.end();
    return;
  }

  const folders = fs
    .readdirSync(migrationsDir)
    .filter((f) => fs.statSync(path.join(migrationsDir, f)).isDirectory())
    .sort();

  for (const folder of folders) {
    const migrationFile = path.join(migrationsDir, folder, 'migration.sql');
    if (fs.existsSync(migrationFile)) {
      console.log(`📦 Applying migration: ${folder}...`);
      const sql = fs.readFileSync(migrationFile, 'utf8');
      await client.query(sql);
      console.log(`✅ Applied: ${folder}`);
    }
  }

  await client.end();
  console.log('🚀 All PostgreSQL migrations applied successfully!');
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}
