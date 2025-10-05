import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import multer from "multer";
import path from "path";
import fs from "fs";
import { promises as fsPromises } from "fs";
import crypto from "crypto";

const router = Router();
const prisma = new PrismaClient();

const uploadRoot = path.resolve(process.cwd(), "uploads", "captains");
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
});

router.get("/", async (req, res) => {
  try {
    const captains = await prisma.captain.findMany({
      orderBy: { name: "asc" },
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

    const captain = await prisma.captain.create({
      data: {
        name,
        cedula,
        phone: phone || null,
        photoUrl,
        signatureUrl,
      },
    });

    res.status(201).json(mapCaptain({ ...captain, signatureData: signatureDataResponse }));
  } catch (error) {
    console.error("[captains] create error:", error);

    if (signatureFilePath) {
      safeUnlink(signatureFilePath, "firma temporal");
    }

    tempPhotoFiles.forEach((filePath) => safeUnlink(filePath, "foto temporal"));

    if (error?.code === "P2002") {
      return res.status(409).json({ error: "Ya existe un capitán registrado con esa cédula" });
    }

    return res.status(400).json({ error: error.message || "No se pudo crear el capitán" });
  }
});

router.get("/:id", async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Identificador inválido" });
  }

  try {
    const captain = await prisma.captain.findUnique({ where: { id } });
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

    const updatedCaptain = await prisma.captain.update({
      where: { id },
      data: {
        name,
        cedula,
        phone: phone || null,
        photoUrl,
        signatureUrl,
      },
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
      return res.status(409).json({ error: "Ya existe un capitán registrado con esa cédula" });
    }

    return res.status(400).json({ error: error.message || "No se pudo actualizar el capitán" });
  }
});

export default router;
