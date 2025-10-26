import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

const normalizeRequiredString = (value, fieldLabel) => {
  if (value === undefined || value === null) {
    throw new Error(`El campo "${fieldLabel}" es obligatorio`);
  }
  const normalized = `${value}`.trim();
  if (!normalized) {
    throw new Error(`El campo "${fieldLabel}" es obligatorio`);
  }
  return normalized;
};

const normalizeOptionalString = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = `${value}`.trim();
  return normalized.length ? normalized : null;
};

const parseMarinerId = (rawId) => {
  const parsed = Number.parseInt(rawId, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const mapMariner = (mariner) => ({
  id: mariner.id,
  name: mariner.name,
  cedula: mariner.cedula,
  phone: mariner.phone || null,
  createdAt: mariner.createdAt,
  updatedAt: mariner.updatedAt,
});

router.get("/", async (_req, res) => {
  try {
    const mariners = await prisma.mariner.findMany({
      orderBy: { name: "asc" },
    });

    return res.json(mariners.map(mapMariner));
  } catch (error) {
    console.error("[mariners] list error", error);
    return res.status(500).json({ error: "No se pudo obtener la lista de marineros" });
  }
});

router.post("/", async (req, res) => {
  try {
    const name = normalizeRequiredString(req.body?.name, "nombre del marinero");
    const cedula = normalizeRequiredString(req.body?.cedula, "cédula del marinero");
    const phone = normalizeOptionalString(req.body?.phone);

    const mariner = await prisma.mariner.create({
      data: {
        name,
        cedula,
        phone,
      },
    });

    return res.status(201).json(mapMariner(mariner));
  } catch (error) {
    console.error("[mariners] create error", error);

    if (error?.code === "P2002") {
      return res.status(409).json({ error: "Ya existe un marinero registrado con esa cédula" });
    }

    return res.status(400).json({ error: error?.message || "No se pudo crear el marinero" });
  }
});

router.get("/:id", async (req, res) => {
  const marinerId = parseMarinerId(req.params.id);
  if (!marinerId) {
    return res.status(400).json({ error: "Identificador inválido" });
  }

  try {
    const mariner = await prisma.mariner.findUnique({ where: { id: marinerId } });
    if (!mariner) {
      return res.status(404).json({ error: "Marinero no encontrado" });
    }

    return res.json(mapMariner(mariner));
  } catch (error) {
    console.error("[mariners] detail error", error);
    return res.status(500).json({ error: "No se pudo obtener la información del marinero" });
  }
});

router.put("/:id", async (req, res) => {
  const marinerId = parseMarinerId(req.params.id);
  if (!marinerId) {
    return res.status(400).json({ error: "Identificador inválido" });
  }

  try {
    const existing = await prisma.mariner.findUnique({ where: { id: marinerId } });
    if (!existing) {
      return res.status(404).json({ error: "Marinero no encontrado" });
    }

    const name = normalizeRequiredString(req.body?.name, "nombre del marinero");
    const cedula = normalizeRequiredString(req.body?.cedula, "cédula del marinero");
    const phone = normalizeOptionalString(req.body?.phone);

    const updated = await prisma.mariner.update({
      where: { id: marinerId },
      data: {
        name,
        cedula,
        phone,
      },
    });

    return res.json(mapMariner(updated));
  } catch (error) {
    console.error("[mariners] update error", error);

    if (error?.code === "P2002") {
      return res.status(409).json({ error: "Ya existe un marinero registrado con esa cédula" });
    }

    return res.status(400).json({ error: error?.message || "No se pudo actualizar el marinero" });
  }
});

router.delete("/:id", async (req, res) => {
  const marinerId = parseMarinerId(req.params.id);
  if (!marinerId) {
    return res.status(400).json({ error: "Identificador inválido" });
  }

  try {
    await prisma.mariner.delete({ where: { id: marinerId } });
    return res.status(204).send();
  } catch (error) {
    console.error("[mariners] delete error", error);
    return res.status(500).json({ error: "No se pudo eliminar el marinero" });
  }
});

export default router;
