import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

const mapService = (service) => ({
  id: service.id,
  code: service.code,
  name: service.name,
  description: service.description ?? null,
  unit: service.unit,
  unitPriceUsd: Number(service.unitPriceUsd),
  unitPriceLocal: service.unitPriceLocal !== null ? Number(service.unitPriceLocal) : null,
  localCurrency: service.localCurrency ?? null,
  isActive: service.isActive,
  createdAt: service.createdAt,
  updatedAt: service.updatedAt,
});

const normalizeText = (value, { fallback = null, required = false, maxLength = 255 } = {}) => {
  if (value === undefined || value === null) {
    if (required) {
      throw new Error("Este campo es requerido");
    }
    return fallback;
  }

  const text = `${value}`.trim();
  if (!text) {
    if (required) {
      throw new Error("Este campo es requerido");
    }
    return fallback;
  }

  if (text.length > maxLength) {
    throw new Error(`El texto excede los ${maxLength} caracteres permitidos`);
  }

  return text;
};

const parseDecimal = (value, field, { required = false, defaultValue = null } = {}) => {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new Error(`${field} es requerido`);
    }
    return defaultValue;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`${field} debe ser un número válido`);
  }
  return numeric;
};

const parseBoolean = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
};

const slugify = (value, fallback = "SERV") => {
  const base = (value ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();

  return base ? base : fallback;
};

const buildSearchFilter = (search) => {
  if (!search) return undefined;
  const text = `%${search.toLowerCase()}%`;
  return {
    OR: [
      { code: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ],
  };
};

async function ensureUniqueCode(base) {
  const sanitized = slugify(base);
  let suffix = 1;
  while (true) {
    const candidate = `${sanitized}-${String(suffix).padStart(3, "0")}`;
    const existing = await prisma.service.findUnique({ where: { code: candidate } });
    if (!existing) {
      return candidate;
    }
    suffix += 1;
  }
}

router.get("/", async (req, res) => {
  const { search, includeInactive } = req.query;

  try {
    const services = await prisma.service.findMany({
      where: {
        ...(includeInactive === "true" ? {} : { isActive: true }),
        ...(search ? buildSearchFilter(search) : {}),
      },
      orderBy: { name: "asc" },
    });

    res.json({ data: services.map(mapService) });
  } catch (error) {
    console.error("[services] error fetching list", error);
    res.status(500).json({ error: "No se pudo obtener la lista de servicios" });
  }
});

router.get("/:id", async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Identificador inválido" });
  }

  try {
    const service = await prisma.service.findUnique({ where: { id } });
    if (!service) {
      return res.status(404).json({ error: "Servicio no encontrado" });
    }

    res.json(mapService(service));
  } catch (error) {
    console.error("[services] error fetching detail", error);
    res.status(500).json({ error: "No se pudo obtener el servicio" });
  }
});

router.post("/", async (req, res) => {
  try {
    const name = normalizeText(req.body?.name, { required: true, maxLength: 120 });
    const code = normalizeText(req.body?.code, { fallback: null, maxLength: 60 });
    const unit = normalizeText(req.body?.unit, { required: true, maxLength: 20 });
    const description = normalizeText(req.body?.description, { fallback: null, maxLength: 500 });
    const unitPriceUsd = parseDecimal(req.body?.unitPriceUsd, "Precio unitario USD", { required: true });
    const unitPriceLocal = parseDecimal(req.body?.unitPriceLocal, "Precio unitario moneda local", { defaultValue: null });
    const localCurrency = normalizeText(req.body?.localCurrency, { fallback: unitPriceLocal !== null ? "VES" : null, maxLength: 10 });
    const isActive = parseBoolean(req.body?.isActive, true);

    const finalCode = code && code.trim().length > 0 ? code.trim().toUpperCase() : await ensureUniqueCode(name);

    const created = await prisma.service.create({
      data: {
        code: finalCode,
        name,
        description,
        unit,
        unitPriceUsd,
        unitPriceLocal,
        localCurrency,
        isActive: isActive ?? true,
      },
    });

    res.status(201).json(mapService(created));
  } catch (error) {
    console.error("[services] error creating", error);
    const message = error instanceof Error ? error.message : "No se pudo crear el servicio";
    res.status(400).json({ error: message });
  }
});

router.put("/:id", async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Identificador inválido" });
  }

  try {
    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Servicio no encontrado" });
    }

    const data = {};

    if (req.body?.name !== undefined) {
      data.name = normalizeText(req.body.name, { required: true, maxLength: 120 });
    }
    if (req.body?.description !== undefined) {
      data.description = normalizeText(req.body.description, { fallback: null, maxLength: 500 });
    }
    if (req.body?.unit !== undefined) {
      data.unit = normalizeText(req.body.unit, { required: true, maxLength: 20 });
    }
    if (req.body?.unitPriceUsd !== undefined) {
      data.unitPriceUsd = parseDecimal(req.body.unitPriceUsd, "Precio unitario USD", { required: true });
    }
    if (req.body?.unitPriceLocal !== undefined) {
      data.unitPriceLocal = parseDecimal(req.body.unitPriceLocal, "Precio unitario moneda local", { defaultValue: null });
    }
    if (req.body?.localCurrency !== undefined) {
      data.localCurrency = normalizeText(req.body.localCurrency, { fallback: null, maxLength: 10 });
    }
    if (req.body?.isActive !== undefined) {
      data.isActive = parseBoolean(req.body.isActive, existing.isActive) ?? existing.isActive;
    }
    if (req.body?.code !== undefined) {
      const desiredCode = normalizeText(req.body.code, { fallback: null, maxLength: 60 });
      if (desiredCode && desiredCode !== existing.code) {
        const duplicated = await prisma.service.findUnique({ where: { code: desiredCode } });
        if (duplicated && duplicated.id !== id) {
          throw new Error("Ya existe un servicio con ese código");
        }
        data.code = desiredCode;
      }
    }

    const updated = await prisma.service.update({
      where: { id },
      data,
    });

    res.json(mapService(updated));
  } catch (error) {
    console.error("[services] error updating", error);
    const message = error instanceof Error ? error.message : "No se pudo actualizar el servicio";
    res.status(400).json({ error: message });
  }
});

router.delete("/:id", async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Identificador inválido" });
  }

  try {
    await prisma.service.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Servicio no encontrado" });
    }
    console.error("[services] error deleting", error);
    res.status(500).json({ error: "No se pudo eliminar el servicio" });
  }
});

export default router;
