#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, writeFileSync, rmSync } from "fs";
import path from "path";

const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");
const SCHEMA_PATH = path.join(process.cwd(), "prisma", "schema.prisma");

const DROP_DEFAULT_BLOCK_REGEX = /--\s*AlterTable\s*(?:\r?\n)+ALTER\s+TABLE[^;]*?ALTER\s+COLUMN\s+`updatedAt`\s+DROP\s+DEFAULT;?\s*/gi;
const DROP_DEFAULT_DIRECT_REGEX = /ALTER\s+TABLE[^;]*?ALTER\s+COLUMN\s+`updatedAt`\s+DROP\s+DEFAULT/gi;
const TABLE_NAME_PATTERNS = [
  { regex: /CREATE\s+TABLE\s+`([^`]+)`/gi, context: "CREATE TABLE" },
  { regex: /ALTER\s+TABLE\s+`([^`]+)`/gi, context: "ALTER TABLE" },
  { regex: /REFERENCES\s+`([^`]+)`/gi, context: "REFERENCES" },
];
const SQL_LINE_COMMENTS_REGEX = /--.*$/gm;
const SQL_BLOCK_COMMENTS_REGEX = /\/\*[\s\S]*?\*\//g;
const SCALAR_TYPES = new Set([
  "String",
  "Int",
  "BigInt",
  "Float",
  "Decimal",
  "Boolean",
  "DateTime",
  "Json",
  "Bytes",
]);

const MODEL_META = buildModelMeta();
const MODEL_NAME_LOOKUP = MODEL_META.nameLookup;
const MODEL_FIELDS = MODEL_META.fields;

function toPascalCase(tableName) {
  return tableName
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");
}

function buildModelMeta() {
  const nameLookup = new Map();
  const fieldLookup = new Map();

  try {
    const schemaContent = readFileSync(SCHEMA_PATH, "utf8");
    const lines = schemaContent.split(/\r?\n/);
    let currentModel = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//")) {
        continue;
      }

      const modelMatch = trimmed.match(/^model\s+(\w+)\s+\{/);
      if (modelMatch) {
        currentModel = modelMatch[1];
        const key = currentModel.toLowerCase();
        nameLookup.set(key, currentModel);
        if (!fieldLookup.has(key)) {
          fieldLookup.set(key, new Map());
        }
        continue;
      }

      if (trimmed === "}" ) {
        currentModel = null;
        continue;
      }

      if (!currentModel || trimmed.startsWith("@@")) {
        continue;
      }

      const fieldMatch = line.match(/^\s*(\w+)\s+([^\s]+)(.*)$/);
      if (!fieldMatch) {
        continue;
      }

      const fieldName = fieldMatch[1];
      const typeToken = fieldMatch[2];
      const attributes = fieldMatch[3] ?? "";

      const baseType = typeToken.replace(/\?$/, "");
      const optional = typeToken.endsWith("?");

      if (!SCALAR_TYPES.has(baseType)) {
        continue;
      }

      const mappedName = extractMappedColumn(fieldName, attributes);
      const columnName = mappedName ?? fieldName;

      const modelKey = currentModel.toLowerCase();
      fieldLookup.get(modelKey).set(columnName.toLowerCase(), {
        fieldName,
        columnName,
        baseType,
        optional,
        attributes,
      });
    }
  } catch (error) {
    console.warn("⚠️ No se pudo leer prisma/schema.prisma para construir metadatos de modelos", error);
  }

  return { nameLookup, fields: fieldLookup };
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
  if (isEffectivelyEmpty(originalContent)) {
    const migrationDir = path.dirname(filePath);
    const relativeDir = path.relative(process.cwd(), migrationDir);
    try {
      rmSync(migrationDir, { recursive: true, force: true });
      console.log(`\n🗑️ Migración vacía detectada y eliminada: ${relativeDir}`);
    } catch (error) {
      console.error(`\n🚫 No se pudo eliminar la migración vacía ${relativeDir}:`, error.message);
      return { fixes: [], remainingIssues: [`No se pudo eliminar la migración vacía ${relativeDir}`] };
    }
    return { fixes: [], remainingIssues: [] };
  }

  let content = originalContent;
  const fixes = [];
  const remainingIssues = [];

  if (DROP_DEFAULT_BLOCK_REGEX.test(content)) {
    DROP_DEFAULT_BLOCK_REGEX.lastIndex = 0;
    content = content.replace(DROP_DEFAULT_BLOCK_REGEX, "");
    fixes.push("Se eliminó bloque 'ALTER COLUMN `updatedAt` DROP DEFAULT'");
  }

  for (const { regex, context } of TABLE_NAME_PATTERNS) {
    regex.lastIndex = 0;
    content = content.replace(regex, (fullMatch, tableName) => {
      const fix = getNormalizedTableName(tableName);
      if (fix) {
        fixes.push(`Nombre de tabla corregido (${context}): '${tableName}' -> '${fix}'`);
        return fullMatch.replace(`\`${tableName}\``, `\`${fix}\``);
      }
      return fullMatch;
    });
  }

  const columnResult = ensureReferencedColumnsExist(content);
  content = columnResult.content;
  fixes.push(...columnResult.fixes);
  remainingIssues.push(...columnResult.issues);

  if (fixes.length > 0 && content !== originalContent) {
    const cleaned = content.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
    writeFileSync(filePath, cleaned, "utf8");
  }

  DROP_DEFAULT_DIRECT_REGEX.lastIndex = 0;
  if (DROP_DEFAULT_DIRECT_REGEX.test(content)) {
    remainingIssues.push(
      "Sigue presente 'ALTER COLUMN `updatedAt` DROP DEFAULT'; revisión manual requerida"
    );
  }

  for (const { regex } of TABLE_NAME_PATTERNS) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const tableName = match[1];
      const normalized = getNormalizedTableName(tableName);
      if (normalized && normalized !== tableName) {
        remainingIssues.push(
          `Nombre de tabla '${tableName}' permanece sin corregir`
        );
      }
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

function getNormalizedTableName(rawName) {
  const normalized = rawName.replace(/`/g, "");
  const lookupKey = normalized.toLowerCase();
  const expectedName = MODEL_NAME_LOOKUP.get(lookupKey);
  if (expectedName && expectedName !== normalized) {
    return expectedName;
  }

  if (!expectedName) {
    if (/^_[a-z0-9_]+$/.test(normalized)) {
      return null;
    }
    if (normalized === lookupKey && /[a-z]/.test(normalized)) {
      const pascal = toPascalCase(normalized);
      if (pascal !== normalized) {
        return pascal;
      }
    }
  }

  return null;
}

function isEffectivelyEmpty(sql) {
  const withoutComments = sql
    .replace(SQL_BLOCK_COMMENTS_REGEX, "")
    .replace(SQL_LINE_COMMENTS_REGEX, "")
    .trim();
  return withoutComments.length === 0;
}

function extractMappedColumn(fieldName, attributes) {
  const mapMatch = attributes.match(/@map\("([^"]+)"\)/);
  if (mapMatch) {
    return mapMatch[1];
  }
  return null;
}

function ensureReferencedColumnsExist(content) {
  const fixes = [];
  const issues = [];
  const missing = [];
  const seen = new Set();

  const considerColumn = (tableNameRaw, columnRaw) => {
    const tableName = normalizeTableName(tableNameRaw);
    const columnName = columnRaw.replace(/`/g, "").trim();
    if (!tableName || !columnName) {
      return;
    }
    const key = `${tableName.toLowerCase()}|${columnName.toLowerCase()}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);

    if (columnDefinedInContent(content, tableName, columnName)) {
      return;
    }

    const fieldInfo = getFieldInfo(tableName, columnName);
    if (!fieldInfo) {
      issues.push(
        `No se encontró definición del campo '${columnName}' en el modelo '${tableName}'`
      );
      return;
    }

    const columnSql = prismaFieldToSqlDefinition(fieldInfo);
    if (!columnSql) {
      issues.push(
        `Tipo de dato no soportado para generar columna '${tableName}.${columnName}'`
      );
      return;
    }

    missing.push({ tableName, columnName: fieldInfo.columnName, columnSql });
  };

  const fkRegex = /ALTER\s+TABLE\s+`([^`]+)`\s+ADD\s+CONSTRAINT\s+`[^`]+`\s+FOREIGN\s+KEY\s*\(([^)]+)\)/gi;
  let fkMatch;
  while ((fkMatch = fkRegex.exec(content)) !== null) {
    const [, tableName, columnList] = fkMatch;
    const columns = columnList.split(",").map((c) => c.replace(/[`\s]/g, "")).filter(Boolean);
    columns.forEach((column) => considerColumn(tableName, column));
  }

  const indexRegex = /CREATE\s+INDEX\s+`[^`]+`\s+ON\s+`([^`]+)`\s*\(([^)]+)\)/gi;
  let indexMatch;
  while ((indexMatch = indexRegex.exec(content)) !== null) {
    const [, tableName, columnList] = indexMatch;
    const columns = columnList.split(",").map((c) => c.replace(/[`\s]/g, "")).filter(Boolean);
    columns.forEach((column) => considerColumn(tableName, column));
  }

  if (missing.length > 0) {
    const statements = missing.map(({ tableName, columnName, columnSql }) => {
      fixes.push(`Columna agregada automáticamente: ${tableName}.${columnName}`);
      return `-- AlterTable\nALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnSql};\n`;
    });
    content = `${statements.join("\n")}${content.startsWith("\n") ? "" : "\n"}${content}`;
  }

  return { content, fixes, issues };
}

function normalizeTableName(tableName) {
  const stripped = tableName.replace(/`/g, "");
  const lookupKey = stripped.toLowerCase();
  return MODEL_NAME_LOOKUP.get(lookupKey) ?? stripped;
}

function columnDefinedInContent(content, tableName, columnName) {
  const tablePattern = escapeRegExp(tableName);
  const columnPattern = escapeRegExp(columnName);

  const createRegex = new RegExp(
    `CREATE\\s+TABLE\\s+\`${tablePattern}\`[\\s\\S]*?\`${columnPattern}\``,
    "i"
  );
  if (createRegex.test(content)) {
    return true;
  }

  const addColumnRegex = new RegExp(
    `ALTER\\s+TABLE\\s+\`${tablePattern}\`[\\s\\S]*?ADD\\s+COLUMN\\s+\`${columnPattern}\``,
    "i"
  );
  return addColumnRegex.test(content);
}

function getFieldInfo(tableName, columnName) {
  const tableKey = tableName.toLowerCase();
  const columnKey = columnName.toLowerCase();
  return MODEL_FIELDS.get(tableKey)?.get(columnKey) ?? null;
}

function prismaFieldToSqlDefinition(fieldInfo) {
  const nullability = fieldInfo.optional ? "NULL" : "NOT NULL";

  switch (fieldInfo.baseType) {
    case "Int":
      return `INTEGER ${nullability}`;
    case "BigInt":
      return `BIGINT ${nullability}`;
    case "Float":
      return `DOUBLE ${nullability}`;
    case "Decimal": {
      const decimalMatch = fieldInfo.attributes.match(/@db\.Decimal\((\d+)\s*,\s*(\d+)\)/i);
      const precision = decimalMatch ? `${decimalMatch[1]}, ${decimalMatch[2]}` : "65, 30";
      return `DECIMAL(${precision}) ${nullability}`;
    }
    case "String": {
      const varcharMatch = fieldInfo.attributes.match(/@db\.(VarChar|String)\((\d+)\)/i);
      const length = varcharMatch ? varcharMatch[2] : "191";
      return `VARCHAR(${length}) ${nullability}`;
    }
    case "Boolean":
      return `BOOLEAN ${nullability}`;
    case "DateTime":
      return `DATETIME(3) ${nullability}`;
    case "Json":
      return `JSON ${nullability}`;
    case "Bytes":
      return `BLOB ${nullability}`;
    default:
      return null;
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
