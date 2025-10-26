import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

const DEFAULT_PRIMARY_COLOR = "#0039B7";
const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{6})$/;

const normalizeString = (value, fallback = "") => {
  if (value === undefined || value === null) {
    return fallback;
  }
  const normalized = String(value).trim();
  return normalized.length ? normalized : fallback;
};

const parseOptionalUrl = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = normalizeString(value);
  return normalized.length ? normalized : null;
};

const normalizeOptionalField = (value, maxLength = 180) => {
  if (value === undefined || value === null) {
    return null;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  if (text.length > maxLength) {
    return text.slice(0, maxLength);
  }
  return text;
};

const mapBrandingSetting = (entity) => ({
  id: entity.id,
  sidebarLogoUrl: entity.sidebarLogoUrl ?? null,
  pdfLogoUrl: entity.pdfLogoUrl ?? null,
  legalName: entity.legalName ?? null,
  taxId: entity.taxId ?? null,
  address: entity.address ?? null,
  phone: entity.phone ?? null,
  primaryColor: entity.primaryColor ?? DEFAULT_PRIMARY_COLOR,
  createdAt: entity.createdAt?.toISOString?.() ?? null,
  updatedAt: entity.updatedAt?.toISOString?.() ?? null,
});

async function getOrCreateBrandingSetting() {
  let setting = await prisma.brandingSetting.findFirst();
  if (!setting) {
    setting = await prisma.brandingSetting.create({ data: { primaryColor: DEFAULT_PRIMARY_COLOR } });
  }
  return setting;
}

router.get("/", async (req, res) => {
  try {
    const setting = await getOrCreateBrandingSetting();
    res.json(mapBrandingSetting(setting));
  } catch (error) {
    console.error("[branding] Error obteniendo configuración", error);
    res.status(500).json({ error: "No se pudo obtener la configuración de branding" });
  }
});

router.put("/", async (req, res) => {
  try {
    const payload = req.body ?? {};
    const rawPrimaryColor = normalizeString(payload.primaryColor, DEFAULT_PRIMARY_COLOR);

    if (!HEX_COLOR_REGEX.test(rawPrimaryColor)) {
      return res.status(400).json({ error: "El color primario debe ser un código hexadecimal válido" });
    }

    const sidebarLogoUrl = parseOptionalUrl(payload.sidebarLogoUrl);
    const pdfLogoUrl = parseOptionalUrl(payload.pdfLogoUrl);
    const legalName = normalizeOptionalField(payload.legalName, 180);
    const taxId = normalizeOptionalField(payload.taxId, 80);
    const address = normalizeOptionalField(payload.address, 250);
    const phone = normalizeOptionalField(payload.phone, 80);

    const data = {
      primaryColor: rawPrimaryColor.toUpperCase(),
      sidebarLogoUrl,
      pdfLogoUrl,
      legalName,
      taxId,
      address,
      phone,
    };

    const existing = await prisma.brandingSetting.findFirst();
    const updated = existing
      ? await prisma.brandingSetting.update({ where: { id: existing.id }, data })
      : await prisma.brandingSetting.create({ data });

    res.json(mapBrandingSetting(updated));
  } catch (error) {
    console.error("[branding] Error actualizando configuración", error);
    res.status(500).json({ error: "No se pudo actualizar la configuración de branding" });
  }
});

export default router;
