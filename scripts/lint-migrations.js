#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import path from "path";

const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");
const SCHEMA_PATH = path.join(process.cwd(), "prisma", "schema.prisma");

const DROP_DEFAULT_BLOCK_REGEX = /--\s*AlterTable\s*(?:\r?\n)+ALTER\s+TABLE[^;]*?ALTER\s+COLUMN\s+`updatedAt`\s+DROP\s+DEFAULT;?\s*/gi;
const DROP_DEFAULT_DIRECT_REGEX = /ALTER\s+TABLE[^;]*?ALTER\s+COLUMN\s+`updatedAt`\s+DROP\s+DEFAULT/gi;
const ALTER_TABLE_REGEX = /ALTER\s+TABLE\s+`([^`]+)`/gi;

const MODEL_NAME_LOOKUP = buildModelNameLookup();

function toPascalCase(tableName) {
  return tableName
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");
}

function buildModelNameLookup() {
  const map = new Map();
  try {
    const schemaContent = readFileSync(SCHEMA_PATH, "utf8");
    const modelRegex = /model\s+(\w+)\s+\{/g;
    let match;
    while ((match = modelRegex.exec(schemaContent)) !== null) {
      map.set(match[1].toLowerCase(), match[1]);
    }
  } catch (error) {
    console.warn("⚠️ No se pudo leer prisma/schema.prisma para construir el mapa de modelos", error);
  }
  return map;
}

function resolveTableName(tableName) {
  const normalized = tableName.replace(/`/g, "");
  const mapped = MODEL_NAME_LOOKUP.get(normalized.toLowerCase());
  return mapped ?? toPascalCase(normalized);
}

function collectMigrationFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const migrationSql = path.join(dir, entry.name, "migration.sql");
    try {
      const stats = statSync(migrationSql);
      if (stats.isFile()) {
        files.push(migrationSql);
      }
    } catch (error) {
      // Ignore missing migration.sql files (some migrations may be empty)
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }
  return files;
}

function lintMigrationFile(filePath) {
  const originalContent = readFileSync(filePath, "utf8");
  let content = originalContent;
  const fixes = [];

  if (DROP_DEFAULT_BLOCK_REGEX.test(content)) {
    DROP_DEFAULT_BLOCK_REGEX.lastIndex = 0;
    content = content.replace(DROP_DEFAULT_BLOCK_REGEX, "");
    fixes.push("Se eliminó bloque 'ALTER COLUMN `updatedAt` DROP DEFAULT'");
  }

  ALTER_TABLE_REGEX.lastIndex = 0;
  content = content.replace(ALTER_TABLE_REGEX, (fullMatch, tableName) => {
    const normalized = tableName.replace(/`/g, "");
    const expectedName = MODEL_NAME_LOOKUP.get(normalized.toLowerCase());
    if (
      normalized === normalized.toLowerCase() &&
      /[a-z]/.test(normalized) &&
      expectedName &&
      expectedName !== normalized
    ) {
      fixes.push(`Nombre de tabla corregido: '${normalized}' -> '${expectedName}'`);
      return `ALTER TABLE \`${expectedName}\``;
    }
    if (!expectedName && normalized === normalized.toLowerCase() && /[a-z]/.test(normalized)) {
      const fixedName = toPascalCase(normalized);
      if (fixedName !== normalized) {
        fixes.push(`Nombre de tabla corregido: '${normalized}' -> '${fixedName}'`);
        return `ALTER TABLE \`${fixedName}\``;
      }
    }
    return fullMatch;
  });

  if (fixes.length > 0 && content !== originalContent) {
    const cleaned = content.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
    writeFileSync(filePath, cleaned, "utf8");
  }

  const remainingIssues = [];
  DROP_DEFAULT_DIRECT_REGEX.lastIndex = 0;
  if (DROP_DEFAULT_DIRECT_REGEX.test(content)) {
    remainingIssues.push(
      "Sigue presente 'ALTER COLUMN `updatedAt` DROP DEFAULT'; revisión manual requerida"
    );
  }

  ALTER_TABLE_REGEX.lastIndex = 0;
  let match;
  while ((match = ALTER_TABLE_REGEX.exec(content)) !== null) {
    const tableName = match[1];
    const normalized = tableName.replace(/`/g, "");
    const expectedName = MODEL_NAME_LOOKUP.get(normalized.toLowerCase());
    if (
      normalized === normalized.toLowerCase() &&
      /[a-z]/.test(normalized) &&
      (!expectedName || expectedName !== normalized)
    ) {
      remainingIssues.push(
        `Nombre de tabla en minúsculas '${normalized}' permanece sin corregir`
      );
    }
  }

  return { fixes, remainingIssues };
}

function main() {
  let hasErrors = false;
  const migrationFiles = collectMigrationFiles(MIGRATIONS_DIR);

  for (const filePath of migrationFiles) {
    const { fixes, remainingIssues } = lintMigrationFile(filePath);

    if (fixes.length > 0) {
      console.log(`\n🔧 Auto-fix aplicado en ${path.relative(process.cwd(), filePath)}:`);
      for (const fix of fixes) {
        console.log(`  - ${fix}`);
      }
    }

    if (remainingIssues.length > 0) {
      hasErrors = true;
      console.error(`\n🚫 Problemas detectados en ${path.relative(process.cwd(), filePath)}:`);
      for (const issue of remainingIssues) {
        console.error(`  - ${issue}`);
      }
    }
  }

  if (hasErrors) {
    console.error("\nArregla las migraciones anteriores antes de continuar.");
    process.exit(1);
  }

  console.log("✅ Migraciones OK");
}

main();
