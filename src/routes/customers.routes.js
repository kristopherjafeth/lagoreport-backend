import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import multer from "multer";
import path from "path";
import fs from "fs";
import { promises as fsPromises } from "fs";
import crypto from "crypto";

const router = Router();
const prisma = new PrismaClient();

const uploadRoot = path.resolve(process.cwd(), "uploads", "customers");
const photosDir = path.join(uploadRoot, "photos");
const signaturesDir = path.join(uploadRoot, "signatures");
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

ensureDir(photosDir);
ensureDir(signaturesDir);

const safeUnlink = (absolutePath, contextLabel = "") => {
  if (!absolutePath) return;
  try {
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (error) {
    console.warn(`[customers] no se pudo eliminar el archivo${contextLabel ? ` (${contextLabel})` : ""}`, absolutePath, error.message);
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDir(photosDir);
    cb(null, photosDir);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const unique = `${Date.now()}-${crypto.randomUUID()}`;
    cb(null, `${unique}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      return cb(new Error("Solo se permiten imágenes en formato JPEG, PNG o WebP"));
    }
    return cb(null, true);
  },
});

const PUBLIC_PHOTO_PREFIX = "/uploads/customers/photos";
const PUBLIC_SIGNATURE_PREFIX = "/uploads/customers/signatures";

const parseDataUrl = (dataUrl) => {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    return null;
  }

  const match = dataUrl.match(/^data:(image\/png|image\/jpeg|image\/webp);base64,(.+)$/);
  if (!match) {
    return null;
  }

  const [, mimeType, base64] = match;
  const buffer = Buffer.from(base64, "base64");
  const extension = mimeType === "image/png" ? ".png" : mimeType === "image/webp" ? ".webp" : ".jpg";
  return { buffer, extension, mimeType };
};

const mapCustomer = (customer) => ({
  id: customer.id,
  name: customer.name,
  cedula: customer.cedula,
  phone: customer.phone || null,
  photoUrl: customer.photoUrl || null,
  signatureUrl: customer.signatureUrl || null,
  createdAt: customer.createdAt,
  updatedAt: customer.updatedAt,
});

router.get("/", async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { name: "asc" },
    });

    res.json(customers.map(mapCustomer));
  } catch (error) {
    console.error("[customers] list error:", error);
    res.status(500).json({ error: "No se pudo obtener la lista de clientes" });
  }
});

router.post("/", upload.single("photo"), async (req, res) => {
  const tempPhotoFiles = [];
  let signatureFilePath = null;

  try {
    const name = `${req.body?.name ?? ""}`.trim();
    const cedula = `${req.body?.cedula ?? ""}`.trim();
    const phone = `${req.body?.phone ?? ""}`.trim();
    const signatureDataRaw = typeof req.body?.signatureData === "string" ? req.body.signatureData : "";
    const signatureData = signatureDataRaw.trim();
    const providedPhotoUrl = `${req.body?.photoUrl ?? ""}`.trim();
    const providedSignatureUrl = `${req.body?.signatureUrl ?? ""}`.trim();

    if (!name) {
      throw new Error("El nombre del cliente es obligatorio");
    }

    if (!cedula) {
      throw new Error("La cédula del cliente es obligatoria");
    }

    if (!signatureData && !providedSignatureUrl) {
      throw new Error("La firma digital del cliente es obligatoria");
    }

    let photoUrl = null;
    const uploadedPhotoAbsolutePath = req.file ? path.resolve(req.file.destination, req.file.filename) : null;
    if (providedPhotoUrl) {
      photoUrl = providedPhotoUrl;
      if (uploadedPhotoAbsolutePath) {
        safeUnlink(uploadedPhotoAbsolutePath, "foto local no utilizada");
      }
    } else if (req.file) {
      photoUrl = `${PUBLIC_PHOTO_PREFIX}/${req.file.filename}`;
      if (uploadedPhotoAbsolutePath) {
        tempPhotoFiles.push(uploadedPhotoAbsolutePath);
      }
    }

    let signatureUrl = providedSignatureUrl || null;

    if (!signatureUrl) {
      const parsedSignature = parseDataUrl(signatureData);
      if (!parsedSignature) {
        throw new Error("La firma digital debe ser una imagen válida en formato base64");
      }

      const signatureFilename = `${Date.now()}-${crypto.randomUUID()}${parsedSignature.extension}`;
      signatureFilePath = path.join(signaturesDir, signatureFilename);
      await fsPromises.writeFile(signatureFilePath, parsedSignature.buffer);

      signatureUrl = `${PUBLIC_SIGNATURE_PREFIX}/${signatureFilename}`;
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        cedula,
        phone: phone || null,
        photoUrl,
        signatureUrl,
      },
    });

    res.status(201).json(mapCustomer(customer));
  } catch (error) {
    console.error("[customers] create error:", error);

    if (signatureFilePath) {
      safeUnlink(signatureFilePath, "firma temporal");
    }

    tempPhotoFiles.forEach((filePath) => safeUnlink(filePath, "foto temporal"));

    if (error?.code === "P2002") {
      return res.status(409).json({ error: "Ya existe un cliente registrado con esa cédula" });
    }

    return res.status(400).json({ error: error.message || "No se pudo crear el cliente" });
  }
});

export default router;
