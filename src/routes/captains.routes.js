import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import multer from "multer";
import path from "path";
import fs from "fs";
import { promises as fsPromises } from "fs";
import crypto from "crypto";
import bcrypt from "bcrypt";

import { ensureUserTwoFactorCode, generateUniqueTwoFactorCode } from "../lib/twoFactor.js";

const router = Router();
const prisma = new PrismaClient();

const SALT_ROUNDS = 10;
const CAPTAIN_ROLE_SLUG = "captain";
const CAPTAIN_EMAIL_DOMAIN = "captains.lagoreport.local";
const RANDOM_PASSWORD_BYTES = 12;

const uploadRoot = path.resolve(process.cwd(), "uploads", "captains");
const photosDir = path.join(uploadRoot, "photos");
const signaturesDir = path.join(uploadRoot, "signatures");
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const normalizeCedulaForEmail = (cedula) => `${cedula ?? ""}`.toLowerCase().replace(/[^a-z0-9]/g, "");

const buildCaptainEmail = (cedula) => {
  const normalized = normalizeCedulaForEmail(cedula);
  if (normalized.length > 0) {
    return `${normalized}@${CAPTAIN_EMAIL_DOMAIN}`;
  }
  const fallback = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `captain-${fallback}@${CAPTAIN_EMAIL_DOMAIN}`;
};

const splitNameParts = (fullName) => {
  const parts = `${fullName ?? ""}`.trim().split(/\s+/).filter(Boolean);
  const firstName = parts.shift() ?? "Capitán";
  const lastName = parts.length > 0 ? parts.join(" ") : "Capitán";
  return { firstName, lastName };
};

const normalizePhone = (value) => {
  if (!value) return null;
  const trimmed = `${value}`.trim();
  return trimmed.length ? trimmed : null;
};

const generateRandomPassword = () => crypto.randomBytes(RANDOM_PASSWORD_BYTES).toString("hex");

const ensureCaptainRoleRecord = async (tx) => {
  return tx.role.upsert({
    where: { slug: CAPTAIN_ROLE_SLUG },
    update: {},
    create: {
      slug: CAPTAIN_ROLE_SLUG,
      name: "Capitán",
      description: "Puede generar y consultar reportes operativos",
      permissions: ["reports:create", "reports:read"],
    },
  });
};

const ensureCaptainUser = async (tx, existingUserId, { name, cedula, phone }) => {
  const role = await ensureCaptainRoleRecord(tx);
  const { firstName, lastName } = splitNameParts(name);
  const email = buildCaptainEmail(cedula).toLowerCase();
  const phoneNumber = normalizePhone(phone);

  if (existingUserId) {
    const updatedUser = await tx.user.update({
      where: { id: existingUserId },
      data: {
        firstName,
        lastName,
        email,
        phoneNumber,
        role: {
          connect: { slug: role.slug },
        },
      },
    });

    await ensureUserTwoFactorCode(tx, updatedUser.id);
    return tx.user.findUnique({ where: { id: updatedUser.id } });
  }

  const passwordHash = await bcrypt.hash(generateRandomPassword(), SALT_ROUNDS);
  const twoFactorCode = await generateUniqueTwoFactorCode(tx);

  return tx.user.create({
    data: {
      firstName,
      lastName,
      email,
      password: passwordHash,
      plan: "Básico",
      status: "active",
      devices: 0,
      lastLogin: new Date(),
      phoneNumber,
      twoFactorCode,
      role: {
        connect: { slug: role.slug },
      },
    },
  });
};

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

ensureDir(photosDir);
ensureDir(signaturesDir);

const PUBLIC_PHOTO_PREFIX = "/uploads/captains/photos";
const PUBLIC_SIGNATURE_PREFIX = "/uploads/captains/signatures";

const toAbsoluteFromPublicPath = (publicPath) => {
  if (!publicPath) return null;
  const trimmed = publicPath.startsWith("/") ? publicPath.slice(1) : publicPath;
  return path.resolve(process.cwd(), trimmed);
};

const safeUnlink = (absolutePath, contextLabel = "") => {
  if (!absolutePath) return;
  try {
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (error) {
    console.warn(`[captains] no se pudo eliminar el archivo${contextLabel ? ` (${contextLabel})` : ""}`, absolutePath, error.message);
  }
};

const isLocalPhotoUrl = (url) => typeof url === "string" && url.startsWith(PUBLIC_PHOTO_PREFIX);
const isLocalSignatureUrl = (url) => typeof url === "string" && url.startsWith(PUBLIC_SIGNATURE_PREFIX);

const deleteLocalPhoto = (publicPath) => {
  if (!isLocalPhotoUrl(publicPath)) return;
  safeUnlink(toAbsoluteFromPublicPath(publicPath), "foto");
};

const deleteLocalSignature = (publicPath) => {
  if (!isLocalSignatureUrl(publicPath)) return;
  safeUnlink(toAbsoluteFromPublicPath(publicPath), "firma");
};

const extensionToMimeType = (extension) => {
  switch (extension) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    default:
      return "image/jpeg";
  }
};

const buildDataUriFromLocalImage = async (publicPath) => {
  const absolutePath = toAbsoluteFromPublicPath(publicPath);
  if (!absolutePath) return null;

  try {
    const buffer = await fsPromises.readFile(absolutePath);
    const extension = path.extname(absolutePath).toLowerCase();
    const mimeType = extensionToMimeType(extension);
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch (error) {
    console.warn("[captains] no se pudo generar data URL", absolutePath, error.message);
    return null;
  }
};

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

const mapCaptainDocument = (document) => ({
  id: document.id,
  title: document.title,
  fileUrl: document.fileUrl,
  fileType: document.fileType || null,
  fileKey: document.fileKey || null,
  uploadedAt: document.uploadedAt,
});

const parsePositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const mapCaptain = (captain) => ({
  id: captain.id,
  name: captain.name,
  cedula: captain.cedula,
  phone: captain.phone || null,
  photoUrl: captain.photoUrl || null,
  signatureUrl: captain.signatureUrl || null,
  signatureData: captain.signatureData || null,
  createdAt: captain.createdAt,
  updatedAt: captain.updatedAt,
  userId: captain.userId ?? null,
  userEmail: captain.user?.email ?? null,
  twoFactorCode: captain.user?.twoFactorCode ?? null,
  documentsCount: captain._count?.documents ?? (Array.isArray(captain.documents) ? captain.documents.length : 0),
  documents: Array.isArray(captain.documents) ? captain.documents.map(mapCaptainDocument) : undefined,
});

router.get("/", async (req, res) => {
  try {
    const captains = await prisma.captain.findMany({
      orderBy: { name: "asc" },
      include: {
        user: true,
        _count: { select: { documents: true } },
      },
    });

    res.json(captains.map(mapCaptain));
  } catch (error) {
    console.error("[captains] list error:", error);
    res.status(500).json({ error: "No se pudo obtener la lista de capitanes" });
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
      throw new Error("El nombre del capitán es obligatorio");
    }

    if (!cedula) {
      throw new Error("La cédula del capitán es obligatoria");
    }

    if (!signatureData && !providedSignatureUrl) {
      throw new Error("La firma digital del capitán es obligatoria");
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
    let signatureDataResponse = providedSignatureUrl || null;

    if (!signatureUrl) {
      const parsedSignature = parseDataUrl(signatureData);
      if (!parsedSignature) {
        throw new Error("La firma digital debe ser una imagen válida en formato base64");
      }

      const signatureFilename = `${Date.now()}-${crypto.randomUUID()}${parsedSignature.extension}`;
      signatureFilePath = path.join(signaturesDir, signatureFilename);
      await fsPromises.writeFile(signatureFilePath, parsedSignature.buffer);
      signatureUrl = `${PUBLIC_SIGNATURE_PREFIX}/${signatureFilename}`;
      signatureDataResponse = signatureData;
    }

    const createdCaptain = await prisma.$transaction(async (tx) => {
      const user = await ensureCaptainUser(tx, null, { name, cedula, phone });
      return tx.captain.create({
        data: {
          name,
          cedula,
          phone: normalizePhone(phone),
          photoUrl,
          signatureUrl,
          userId: user.id,
        },
        include: { user: true },
      });
    });

    res.status(201).json(
      mapCaptain({
        ...createdCaptain,
        signatureData: signatureDataResponse,
        documents: [],
        _count: { documents: 0 },
      })
    );
  } catch (error) {
    console.error("[captains] create error:", error);

    if (signatureFilePath) {
      safeUnlink(signatureFilePath, "firma temporal");
    }

    tempPhotoFiles.forEach((filePath) => safeUnlink(filePath, "foto temporal"));

    if (error?.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(",") : error.meta?.target;
      if (target && target.includes("cedula")) {
        return res.status(409).json({ error: "Ya existe un capitán registrado con esa cédula" });
      }
      if (target && target.includes("email")) {
        return res.status(409).json({ error: "Ya existe un usuario registrado con el correo generado para este capitán" });
      }
      if (target && target.includes("twoFactorCode")) {
        return res.status(409).json({ error: "No se pudo asignar el código 2FA porque ya está en uso. Intenta nuevamente." });
      }
      return res.status(409).json({ error: "Los datos del capitán o del usuario asociado ya están registrados" });
    }

    if (error instanceof Error && error.message.includes("código de verificación")) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(400).json({ error: error.message || "No se pudo crear el capitán" });
  }
});

router.get("/:id/documents", async (req, res) => {
  const captainId = parsePositiveInt(req.params.id);
  if (!captainId) {
    return res.status(400).json({ error: "Identificador inválido" });
  }

  try {
    const documents = await prisma.captainDocument.findMany({
      where: { captainId },
      orderBy: { uploadedAt: "desc" },
    });
    return res.json(documents.map(mapCaptainDocument));
  } catch (error) {
    console.error("[captains] list documents error:", error);
    return res.status(500).json({ error: "No se pudieron obtener los documentos del capitán" });
  }
});

router.post("/:id/documents", async (req, res) => {
  const captainId = parsePositiveInt(req.params.id);
  if (!captainId) {
    return res.status(400).json({ error: "Identificador inválido" });
  }

  try {
    const captain = await prisma.captain.findUnique({ where: { id: captainId }, select: { id: true } });
    if (!captain) {
      return res.status(404).json({ error: "Capitán no encontrado" });
    }

    const title = `${req.body?.title ?? ""}`.trim();
    const fileUrl = `${req.body?.fileUrl ?? ""}`.trim();
    const fileTypeRaw = req.body?.fileType;
    const fileKeyRaw = req.body?.fileKey;

    if (!title) {
      throw new Error("El nombre del documento es obligatorio");
    }

    if (!fileUrl) {
      throw new Error("La URL del documento es obligatoria");
    }

    const document = await prisma.captainDocument.create({
      data: {
        captainId,
        title,
        fileUrl,
        fileType: typeof fileTypeRaw === "string" ? fileTypeRaw.trim() || null : null,
        fileKey: typeof fileKeyRaw === "string" ? fileKeyRaw.trim() || null : null,
      },
    });

    return res.status(201).json(mapCaptainDocument(document));
  } catch (error) {
    console.error("[captains] create document error:", error);
    return res.status(400).json({ error: error?.message || "No se pudo registrar el documento" });
  }
});

router.delete("/:id/documents/:documentId", async (req, res) => {
  const captainId = parsePositiveInt(req.params.id);
  const documentId = parsePositiveInt(req.params.documentId);

  if (!captainId || !documentId) {
    return res.status(400).json({ error: "Identificadores inválidos" });
  }

  try {
    const document = await prisma.captainDocument.findFirst({
      where: { id: documentId, captainId },
    });

    if (!document) {
      return res.status(404).json({ error: "Documento no encontrado" });
    }

    await prisma.captainDocument.delete({ where: { id: document.id } });

    return res.status(204).send();
  } catch (error) {
    console.error("[captains] delete document error:", error);
    return res.status(500).json({ error: "No se pudo eliminar el documento" });
  }
});

router.get("/:id", async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Identificador inválido" });
  }

  try {
    const captain = await prisma.captain.findUnique({
      where: { id },
      include: {
        user: true,
        documents: {
          orderBy: { uploadedAt: "desc" },
        },
        _count: { select: { documents: true } },
      },
    });
    if (!captain) {
      return res.status(404).json({ error: "Capitán no encontrado" });
    }

    const mapped = mapCaptain(captain);
    if (mapped.signatureUrl && isLocalSignatureUrl(mapped.signatureUrl)) {
      mapped.signatureData = await buildDataUriFromLocalImage(mapped.signatureUrl);
    }

    return res.json(mapped);
  } catch (error) {
    console.error("[captains] get-by-id error:", error);
    return res.status(500).json({ error: "No se pudo obtener la información del capitán" });
  }
});

router.put("/:id", upload.single("photo"), async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Identificador inválido" });
  }

  const existing = await prisma.captain.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: "Capitán no encontrado" });
  }

  const tempPhotoFiles = [];
  const uploadedPhotoAbsolutePath = req.file ? path.resolve(req.file.destination, req.file.filename) : null;
  let newSignatureFilePath = null;
  const photosToDeleteAfterSuccess = new Set();
  const signaturesToDeleteAfterSuccess = new Set();

  try {
    const name = `${req.body?.name ?? ""}`.trim();
    const cedula = `${req.body?.cedula ?? ""}`.trim();
    const phone = `${req.body?.phone ?? ""}`.trim();

    if (!name) {
      throw new Error("El nombre del capitán es obligatorio");
    }

    if (!cedula) {
      throw new Error("La cédula del capitán es obligatoria");
    }

    const hasPhotoUrlField = Object.prototype.hasOwnProperty.call(req.body ?? {}, "photoUrl");
    const incomingPhotoUrl = hasPhotoUrlField ? `${req.body.photoUrl ?? ""}`.trim() : undefined;

    let photoUrl = existing.photoUrl;

    if (hasPhotoUrlField) {
      if (!incomingPhotoUrl) {
        if (photoUrl && isLocalPhotoUrl(photoUrl)) {
          photosToDeleteAfterSuccess.add(photoUrl);
        }
        photoUrl = null;
      } else {
        if (photoUrl && incomingPhotoUrl !== photoUrl && isLocalPhotoUrl(photoUrl)) {
          photosToDeleteAfterSuccess.add(photoUrl);
        }
        photoUrl = incomingPhotoUrl;
      }
    }

    if (req.file) {
      if (hasPhotoUrlField && incomingPhotoUrl) {
        safeUnlink(uploadedPhotoAbsolutePath, "foto local no utilizada");
      } else {
        if (uploadedPhotoAbsolutePath) {
          tempPhotoFiles.push(uploadedPhotoAbsolutePath);
        }
        if (photoUrl && isLocalPhotoUrl(photoUrl)) {
          photosToDeleteAfterSuccess.add(photoUrl);
        }
        photoUrl = `${PUBLIC_PHOTO_PREFIX}/${req.file.filename}`;
      }
    }

    let signatureUrl = existing.signatureUrl;
    let signatureDataResponse = null;

    const hasSignatureUrlField = Object.prototype.hasOwnProperty.call(req.body ?? {}, "signatureUrl");
    const incomingSignatureUrl = hasSignatureUrlField ? `${req.body.signatureUrl ?? ""}`.trim() : undefined;

    if (hasSignatureUrlField) {
      if (!incomingSignatureUrl) {
        if (signatureUrl && isLocalSignatureUrl(signatureUrl)) {
          signaturesToDeleteAfterSuccess.add(signatureUrl);
        }
        signatureUrl = null;
      } else {
        if (signatureUrl && incomingSignatureUrl !== signatureUrl && isLocalSignatureUrl(signatureUrl)) {
          signaturesToDeleteAfterSuccess.add(signatureUrl);
        }
        signatureUrl = incomingSignatureUrl;
        signatureDataResponse = incomingSignatureUrl;
      }
    }

    const signatureDataRaw = typeof req.body?.signatureData === "string" ? req.body.signatureData : "";
    const normalizedSignatureData = signatureDataRaw.trim();
    if ((!hasSignatureUrlField || !incomingSignatureUrl) && normalizedSignatureData) {
      const parsedSignature = parseDataUrl(normalizedSignatureData);
      if (!parsedSignature) {
        throw new Error("La firma digital debe ser una imagen válida en formato base64");
      }

      const signatureFilename = `${Date.now()}-${crypto.randomUUID()}${parsedSignature.extension}`;
      newSignatureFilePath = path.join(signaturesDir, signatureFilename);
      await fsPromises.writeFile(newSignatureFilePath, parsedSignature.buffer);

      if (signatureUrl && isLocalSignatureUrl(signatureUrl)) {
        signaturesToDeleteAfterSuccess.add(signatureUrl);
      }

      signatureUrl = `${PUBLIC_SIGNATURE_PREFIX}/${signatureFilename}`;
      signatureDataResponse = normalizedSignatureData;
    }

    const updatedCaptain = await prisma.$transaction(async (tx) => {
      const user = await ensureCaptainUser(tx, existing.userId, { name, cedula, phone });
      return tx.captain.update({
        where: { id },
        data: {
          name,
          cedula,
          phone: normalizePhone(phone),
          photoUrl,
          signatureUrl,
          userId: existing.userId ?? user.id,
        },
        include: {
          user: true,
          documents: {
            orderBy: { uploadedAt: "desc" },
          },
          _count: { select: { documents: true } },
        },
      });
    });

    photosToDeleteAfterSuccess.forEach((publicPath) => deleteLocalPhoto(publicPath));
    signaturesToDeleteAfterSuccess.forEach((publicPath) => deleteLocalSignature(publicPath));

    if (!signatureDataResponse && updatedCaptain.signatureUrl && isLocalSignatureUrl(updatedCaptain.signatureUrl)) {
      signatureDataResponse = await buildDataUriFromLocalImage(updatedCaptain.signatureUrl);
    }

    const mapped = mapCaptain({ ...updatedCaptain, signatureData: signatureDataResponse });

    return res.json(mapped);
  } catch (error) {
    console.error("[captains] update error:", error);

    if (newSignatureFilePath) {
      safeUnlink(newSignatureFilePath, "firma temporal");
    }

    tempPhotoFiles.forEach((filePath) => safeUnlink(filePath, "foto temporal"));

    if (error?.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(",") : error.meta?.target;
      if (target && target.includes("cedula")) {
        return res.status(409).json({ error: "Ya existe un capitán registrado con esa cédula" });
      }
      if (target && target.includes("email")) {
        return res.status(409).json({ error: "Ya existe un usuario registrado con el correo generado para este capitán" });
      }
      if (target && target.includes("twoFactorCode")) {
        return res.status(409).json({ error: "No se pudo asignar el código 2FA porque ya está en uso. Intenta nuevamente." });
      }
      return res.status(409).json({ error: "Los datos del capitán o del usuario asociado ya están registrados" });
    }

    if (error instanceof Error && error.message.includes("código de verificación")) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(400).json({ error: error.message || "No se pudo actualizar el capitán" });
  }
});

export default router;
