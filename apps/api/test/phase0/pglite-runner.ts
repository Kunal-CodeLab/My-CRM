import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';

export async function createTestDatabase() {
  const db = new PGlite();

  // Read and execute all migrations in sorted sequence
  const migrationsDir = path.resolve(__dirname, '../../prisma/migrations');
  const migrationFolders = fs
    .readdirSync(migrationsDir)
    .filter((f) => fs.statSync(path.join(migrationsDir, f)).isDirectory())
    .sort();

  for (const folder of migrationFolders) {
    const migrationFile = path.join(migrationsDir, folder, 'migration.sql');
    if (fs.existsSync(migrationFile)) {
      const migrationSql = fs.readFileSync(migrationFile, 'utf8');
      await db.exec(migrationSql);
    }
  }

  return db;
}
