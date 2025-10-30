import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import multer from "multer";
import path from "path";
import fs from "fs";
import { promises as fsPromises } from "fs";
import crypto from "crypto";
import Handlebars from "handlebars";
import puppeteer from "puppeteer";

import { buildTwoFactorError, findUserByTwoFactorCode, isValidStaticCode } from "../lib/twoFactor.js";

const router = Router();
const prisma = new PrismaClient();

const uploadRoot = path.resolve(process.cwd(), "uploads", "report-activities");
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

function ensureUploadDir() {
  if (!fs.existsSync(uploadRoot)) {
    fs.mkdirSync(uploadRoot, { recursive: true });
  }
}

ensureUploadDir();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadDir();
    cb(null, uploadRoot);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || "");
    const unique = `${Date.now()}-${crypto.randomUUID()}`;
    cb(null, `${unique}${extension}`.toLowerCase());
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES, files: 20 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      return cb(new Error("Solo se permiten archivos de imagen"));
    }
    return cb(null, true);
  },
});

const PUBLIC_UPLOAD_PREFIX = "/uploads/report-activities";

const STATIC_CODE_HEADER_KEYS = ["x-two-factor-code", "x-user-code"]; // allow legacy header names

const extractStaticCodeFromRequest = (req) => {
  for (const headerKey of STATIC_CODE_HEADER_KEYS) {
    const headerValue = req.headers?.[headerKey];
    if (typeof headerValue === "string" && headerValue.trim()) {
      return headerValue.trim();
    }
  }

  const bodyValue = req.body?.twoFactorCode ?? req.body?.userCode ?? null;
  if (typeof bodyValue === "string" && bodyValue.trim()) {
    return bodyValue.trim();
  }

  // when payload is JSON-encoded inside "data", try to parse minimal info without mutating original parsing flow
  if (typeof req.body?.data === "string") {
    try {
      const parsed = JSON.parse(req.body.data);
      const nested = parsed?.twoFactorCode ?? parsed?.userCode;
      if (typeof nested === "string" && nested.trim()) {
        return nested.trim();
      }
    } catch (error) {
      // ignore parsing errors here; the main payload parser will surface issues later if needed
    }
  }

  return null;
};

const ensureStaticCodeUser = async (req) => {
  const code = extractStaticCodeFromRequest(req);
  if (!isValidStaticCode(code ?? "")) {
    throw buildTwoFactorError("Debes ingresar tu código de 6 dígitos para continuar", 400);
  }

  const user = await findUserByTwoFactorCode(prisma, code);
  req.twoFactorUser = user;
  return user;
};

const parseDate = (value, fieldName) => {
  if (!value) {
    throw new Error(`${fieldName} es requerido`);
  }

  if (typeof value === "string") {
    const dateOnlyMatch = value.trim().match(/^\s*(\d{4})-(\d{2})-(\d{2})\s*$/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      const numericYear = Number.parseInt(year, 10);
      const numericMonth = Number.parseInt(month, 10) - 1;
      const numericDay = Number.parseInt(day, 10);
      if (
        Number.isNaN(numericYear) ||
        Number.isNaN(numericMonth) ||
        Number.isNaN(numericDay)
      ) {
        throw new Error(`${fieldName} no es una fecha válida`);
      }
      return new Date(Date.UTC(numericYear, numericMonth, numericDay));
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} no es una fecha válida`);
  }
  return date;
};

const combineDateAndTime = (baseDate, time, fieldName) => {
  if (!time || typeof time !== "string") {
    throw new Error(`${fieldName} es requerido`);
  }
  if (!(baseDate instanceof Date) || Number.isNaN(baseDate.getTime())) {
    throw new Error(`${fieldName} no cuenta con una fecha base válida`);
  }

  const trimmed = time.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    throw new Error(`${fieldName} debe tener el formato HH:MM`);
  }

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error(`${fieldName} debe ser una hora válida`);
  }

  const year = baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth();
  const day = baseDate.getUTCDate();
  return new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));
};

const normalizeEndDate = (start, end) => {
  const normalized = new Date(end);
  while (normalized <= start) {
    normalized.setUTCDate(normalized.getUTCDate() + 1);
  }
  return normalized;
};

const minutesBetween = (start, end) => {
  return Math.round((end.getTime() - start.getTime()) / 60000);
};

const normalizeString = (value, fallback = "") => {
  if (value === undefined || value === null) return fallback;
  const text = `${value}`.trim();
  return text.length ? text : fallback;
};

const buildTwoFactorUserMetadata = (user) => {
  if (!user || typeof user !== "object") {
    return { id: null, fullName: null, email: null };
  }

  const parts = [user.firstName, user.lastName]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter((part) => part.length > 0);

  let fullName = parts.join(" ");
  if (!fullName.length) {
    if (typeof user.email === "string" && user.email.trim().length) {
      fullName = user.email.trim();
    } else if (typeof user.name === "string" && user.name.trim().length) {
      fullName = user.name.trim();
    } else {
      fullName = null;
    }
  }

  const email = typeof user.email === "string" && user.email.trim().length ? user.email.trim() : null;

  return {
    id: typeof user.id === "number" ? user.id : null,
    fullName,
    email,
  };
};

const parseOptionalCoordinate = (value, fieldName, min, max) => {
  if (value === undefined || value === null) {
    return null;
  }

  const text = `${value}`.trim();
  if (!text.length) {
    return null;
  }

  const numeric = Number.parseFloat(text);
  if (Number.isNaN(numeric) || numeric < min || numeric > max) {
    throw new Error(`${fieldName} debe estar entre ${min} y ${max} grados`);
  }

  return numeric;
};

const parseOptionalLatitude = (value, fieldName = "latitude") =>
  parseOptionalCoordinate(value, fieldName, -90, 90);

const parseOptionalLongitude = (value, fieldName = "longitude") =>
  parseOptionalCoordinate(value, fieldName, -180, 180);

const createFormatter = (locales, options) => {
  try {
    return new Intl.DateTimeFormat(locales, options);
  } catch (error) {
    return new Intl.DateTimeFormat("es-ES", options);
  }
};

const DATE_FORMATTER = createFormatter("es-VE", { dateStyle: "long" });
const DATE_SHORT_FORMATTER = createFormatter("es-VE", { dateStyle: "medium" });
const WEEKDAY_FORMATTER = createFormatter("es-VE", { weekday: "long" });
const TIME_FORMATTER = createFormatter("es-VE", { hour: "numeric", minute: "numeric", hour12: true });

const formatDate = (date) => (date instanceof Date ? DATE_FORMATTER.format(date) : "");
const formatDateShort = (date) => (date instanceof Date ? DATE_SHORT_FORMATTER.format(date) : "");
const formatWeekday = (date) => (date instanceof Date ? WEEKDAY_FORMATTER.format(date) : "");
const formatTime = (date) => (date instanceof Date ? TIME_FORMATTER.format(date) : "");

const formatDuration = (minutesTotal) => {
  const minutes = Math.max(Number(minutesTotal) || 0, 0);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
};

const REPORT_STATUS_VALUES = ["PENDING", "APPROVED", "REJECTED"];
const REPORT_STATUS_SET = new Set(REPORT_STATUS_VALUES);
const REPORT_STATUS_LABELS = {
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
};

const normalizeReportStatus = (value) => {
  const normalized = `${value ?? ""}`.trim().toUpperCase();
  if (!normalized) {
    return "PENDING";
  }
  if (!REPORT_STATUS_SET.has(normalized)) {
    throw new Error("El estado del reporte es inválido");
  }
  return normalized;
};

const REPORT_TEMPLATE_PATH = path.resolve(process.cwd(), "templates", "report.html");
const REPORT_LOGO_PATH = path.resolve(process.cwd(), "public", "logoreporte.jpg");
const MAX_ACTIVITY_ROWS = 14;

let reportTemplateCache = {
  compiled: null,
  mtimeMs: null,
};
let defaultLogoDataUriPromise = null;

async function getReportTemplate() {
  try {
    const stats = await fsPromises.stat(REPORT_TEMPLATE_PATH);
    if (!reportTemplateCache.compiled || reportTemplateCache.mtimeMs !== stats.mtimeMs) {
      const content = await fsPromises.readFile(REPORT_TEMPLATE_PATH, "utf-8");
      reportTemplateCache = {
        compiled: Handlebars.compile(content),
        mtimeMs: stats.mtimeMs,
      };
    }
    return reportTemplateCache.compiled;
  } catch (error) {
    reportTemplateCache = { compiled: null, mtimeMs: null };
    throw error;
  }
}

async function getDefaultLogoDataUri() {
  if (!defaultLogoDataUriPromise) {
    defaultLogoDataUriPromise = fsPromises
      .readFile(REPORT_LOGO_PATH)
      .then((buffer) => {
        const extension = path.extname(REPORT_LOGO_PATH).toLowerCase();
        const mimeType = extension === ".png" ? "image/png" : extension === ".svg" ? "image/svg+xml" : "image/jpeg";
        return `data:${mimeType};base64,${buffer.toString("base64")}`;
      })
      .catch(() => null);
  }
  return defaultLogoDataUriPromise;
}

async function getLogoDataUri() {
  try {
    const brandingSetting = await prisma.brandingSetting.findFirst();
    if (brandingSetting?.pdfLogoUrl) {
      const customLogoDataUri = await toDataUriFromImagePath(brandingSetting.pdfLogoUrl);
      if (customLogoDataUri) {
        return customLogoDataUri;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.warn("[reports] no se pudo cargar el logo personalizado", message);
  }

  return getDefaultLogoDataUri();
}

const toDate = (value) => {
  if (value instanceof Date) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const escapeLinesToHtml = (lines) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    return "&nbsp;";
  }
  const sanitized = lines
    .map((line) => (typeof line === "string" ? line.trim() : ""))
    .filter((line) => line.length > 0)
    .map((line) => Handlebars.escapeExpression(line));

  if (!sanitized.length) {
    return "&nbsp;";
  }

  return sanitized.join("<br />");
};

const textToHtml = (text) => {
  if (!text || typeof text !== "string") {
    return "&nbsp;";
  }
  const escaped = Handlebars.escapeExpression(text.trim());
  return escaped.length ? escaped.replace(/\r?\n/g, "<br />") : "&nbsp;";
};

async function renderReportHtml(report) {
  const template = await getReportTemplate();
  const logoDataUri = await getLogoDataUri();

  const serviceDate = toDate(report.serviceDate);
  const serviceStart = toDate(report.serviceStart);
  const serviceEnd = toDate(report.serviceEnd);
  const serviceDayLabel = serviceDate ? formatWeekday(serviceDate) : "";

  const preparedActivities = (report.activities || [])
    .slice(0, MAX_ACTIVITY_ROWS)
    .map((activity, index) => {
      const startedAt = toDate(activity.startedAt);
      const endedAt = toDate(activity.endedAt);

      const detailLines = [activity.description];
      if (activity.imageUrl) {
        detailLines.push(`Evidencia: ${activity.imageUrl}`);
      }

      return {
        index: index + 1,
        startTime: startedAt ? formatTime(startedAt) : "",
        endTime: endedAt ? formatTime(endedAt) : "",
        descriptionHtml: escapeLinesToHtml(detailLines),
      };
    });

  const emptyRows = Math.max(MAX_ACTIVITY_ROWS - preparedActivities.length, 0);

  const serviceStartLabel = serviceStart ? formatTime(serviceStart) : "";
  const serviceEndLabel = serviceEnd ? formatTime(serviceEnd) : "";
  const serviceRangeLabel = [serviceStartLabel, serviceEndLabel].filter((value) => value && value.length > 0).join(" - ");

  const captainSignatureDataUri = await toDataUriFromImagePath(report?.captain?.signatureUrl);
  const clientSignatureDataUri = await toDataUriFromImagePath(report?.customer?.signatureUrl);
  const supportImageDataUri = await toDataUriFromImagePath(report?.supportImageUrl);

  const statusLabel = REPORT_STATUS_LABELS[report.status] ?? report.status;

  const context = {
    logoDataUri,
    reportNumber: String(report.id).padStart(5, "0"),
    vesselName: report.vesselName || "",
    captainName: report.captainName || "",
    clientName: report.clientName || "",
    serviceDateLabel: serviceDate ? formatDateShort(serviceDate) : "",
    serviceDayLabel: serviceDayLabel ? serviceDayLabel.toUpperCase() : "",
    serviceRangeLabel,
    totalServiceLabel: formatDuration(report.totalServiceMinutes),
    notesHtml: textToHtml(report.notes || ""),
    patronName: report.patronName || "",
    motoristaName: report.motoristaName || "",
    cookName: report.cookName || "",
    sailorName: report.sailorName || "",
    companySupervisorName: report.companySupervisorName || "",
    clientSupervisorName: report.clientSupervisorName || "",
    activities: preparedActivities,
    emptyRows: Array.from({ length: emptyRows }),
    generatedAtLabel: formatDate(new Date()),
    captainSignatureDataUri,
    clientSignatureDataUri,
    supportImageDataUri,
    status: report.status,
    statusLabel,
  };

  return template(context);
}

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value === "true" || value === "1";
  }
  return false;
};

const toPublicImagePath = (filename) => {
  return `${PUBLIC_UPLOAD_PREFIX}/${filename}`;
};

const isDataUri = (value) => typeof value === "string" && value.trim().startsWith("data:");

const isHttpUrl = (value) => typeof value === "string" && /^https?:\/\//i.test(value);

const toAbsoluteImagePath = (imageUrl) => {
  if (!imageUrl || isHttpUrl(imageUrl)) return null;
  const trimmed = imageUrl.startsWith("/") ? imageUrl.slice(1) : imageUrl;
  return path.resolve(process.cwd(), trimmed);
};

const imageExtensionToMime = (extension) => {
  switch (extension) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".gif":
      return "image/gif";
    default:
      return "image/jpeg";
  }
};

const toDataUriFromImagePath = async (publicPath) => {
  if (!publicPath) return null;
  if (isDataUri(publicPath)) return publicPath;

  if (isHttpUrl(publicPath)) {
    if (typeof fetch !== "function") {
      console.warn("[reports] fetch no disponible para obtener imagen remota", publicPath);
      return null;
    }

    try {
      const response = await fetch(publicPath);
      if (!response.ok) {
        throw new Error(`Respuesta ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentTypeHeader = response.headers.get("content-type") || "image/jpeg";
      const [mimeType = "image/jpeg"] = contentTypeHeader.split(";");
      return `data:${mimeType};base64,${buffer.toString("base64")}`;
    } catch (error) {
      console.warn("[reports] no se pudo obtener la imagen remota", publicPath, error.message);
      return null;
    }
  }

  const absolutePath = toAbsoluteImagePath(publicPath);
  if (!absolutePath) return null;

  try {
    const buffer = await fsPromises.readFile(absolutePath);
    const extension = path.extname(absolutePath).toLowerCase();
    const mimeType = imageExtensionToMime(extension);
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch (error) {
    console.warn("[reports] no se pudo cargar la imagen", absolutePath, error.message);
    return null;
  }
};

const deleteFileIfExists = (absolutePath) => {
  if (!absolutePath) return;
  try {
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (error) {
    console.warn("[reports] no se pudo eliminar el archivo", absolutePath, error.message);
  }
};

const buildFileMap = (files) => {
  const map = new Map();
  if (!Array.isArray(files)) return map;
  files.forEach((file) => {
    map.set(file.fieldname, file);
  });
  return map;
};

const cleanupUploadedFiles = (files) => {
  files.forEach((filePath) => {
    deleteFileIfExists(filePath);
  });
};

const parseActivities = (activitiesInput, baseDate, serviceStart, serviceEnd) => {
  if (!Array.isArray(activitiesInput) || activitiesInput.length === 0) {
    throw new Error("Debes incluir al menos una actividad");
  }

  const parsed = activitiesInput.map((activity, index) => {
    const description = normalizeString(activity?.description);
    if (!description) {
      throw new Error(`La actividad ${index + 1} requiere una descripción`);
    }

    const clientKey = normalizeString(activity?.clientKey, activity?.id ? `existing-${activity.id}` : `idx-${index}`);
    const id = activity?.id ? Number.parseInt(activity.id, 10) : undefined;
    if (activity?.id !== undefined && Number.isNaN(id)) {
      throw new Error(`La actividad ${index + 1} tiene un identificador inválido`);
    }

    const startedAt = combineDateAndTime(baseDate, normalizeString(activity?.startTime), `activities[${index}].startTime`);
    const rawEnd = combineDateAndTime(baseDate, normalizeString(activity?.endTime), `activities[${index}].endTime`);
    const endedAt = normalizeEndDate(startedAt, rawEnd);

    const durationMinutes = minutesBetween(startedAt, endedAt);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      throw new Error(`La actividad ${index + 1} debe tener una duración mayor a cero`);
    }

    if (startedAt < serviceStart) {
      throw new Error(`La actividad ${index + 1} inicia antes del horario del reporte`);
    }

    if (endedAt > serviceEnd) {
      throw new Error(`La actividad ${index + 1} termina después del horario permitido del reporte`);
    }

    const latitude = parseOptionalLatitude(activity?.latitude, `activities[${index}].latitude`);
    const longitude = parseOptionalLongitude(activity?.longitude, `activities[${index}].longitude`);

    return {
      id,
      clientKey,
      description,
      startedAt,
      endedAt,
      durationMinutes,
      latitude,
      longitude,
      removeImage: parseBoolean(activity?.removeImage),
      existingImageUrl: normalizeString(activity?.imageUrl, "") || null,
      fileField: `activityFile-${clientKey}`,
    };
  });

  const sorted = [...parsed].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].startedAt < sorted[i - 1].endedAt) {
      throw new Error("Las actividades no pueden solaparse en el tiempo");
    }
  }

  return parsed;
};

const parseReportPayload = (rawPayload) => {
  let payload;
  if (typeof rawPayload === "string") {
    try {
      payload = JSON.parse(rawPayload);
    } catch (error) {
      throw new Error("El cuerpo de la solicitud no contiene JSON válido");
    }
  } else if (typeof rawPayload === "object" && rawPayload !== null) {
    payload = rawPayload;
  } else {
    throw new Error("Datos de reporte inválidos");
  }

  const vesselName = normalizeString(payload.vesselName);
  const vesselId = payload.vesselId !== undefined && payload.vesselId !== null
    ? Number.parseInt(payload.vesselId, 10)
    : null;
  if (vesselId !== null && Number.isNaN(vesselId)) {
    throw new Error("El identificador de la embarcación es inválido");
  }
  const captainName = normalizeString(payload.captainName, "");
  const clientName = normalizeString(payload.clientName, "");
  const patronName = normalizeString(payload.patronName);
  const motoristaName = normalizeString(payload.motoristaName);
  const cookName = normalizeString(payload.cookName);
  const sailorName = normalizeString(payload.sailorName);
  const companySupervisorName = normalizeString(payload.companySupervisorName, "");
  const clientSupervisorName = normalizeString(payload.clientSupervisorName, "");
  const notes = normalizeString(payload.notes, "");
  const status = normalizeReportStatus(payload.status);

  const supportImageUrlRaw = payload.supportImageUrl;
  const supportImageUrlNormalized = (() => {
    if (supportImageUrlRaw === undefined || supportImageUrlRaw === null) {
      return null;
    }
    const value = normalizeString(supportImageUrlRaw);
    return value.length ? value : null;
  })();
  const removeSupportImage = parseBoolean(payload.removeSupportImage);

  const captainId = payload.captainId !== undefined && payload.captainId !== null
    ? Number.parseInt(payload.captainId, 10)
    : null;
  if (captainId !== null && Number.isNaN(captainId)) {
    throw new Error("El identificador del capitán es inválido");
  }

  const customerId = payload.customerId !== undefined && payload.customerId !== null
    ? Number.parseInt(payload.customerId, 10)
    : null;
  if (customerId !== null && Number.isNaN(customerId)) {
    throw new Error("El identificador del cliente es inválido");
  }

  const teamId = payload.teamId !== undefined && payload.teamId !== null
    ? Number.parseInt(payload.teamId, 10)
    : null;
  if (teamId !== null && Number.isNaN(teamId)) {
    throw new Error("El identificador del equipo es inválido");
  }

  if (!vesselId && !vesselName) {
    throw new Error("Debes seleccionar o escribir el nombre de la embarcación");
  }

  if (!teamId && !captainId && !captainName) {
    throw new Error("Debes seleccionar o escribir el nombre del capitán");
  }

  if (!customerId && !clientName) {
    throw new Error("Debes seleccionar o escribir el nombre del cliente");
  }

  const latitude = parseOptionalLatitude(payload.latitude, "latitude");
  const longitude = parseOptionalLongitude(payload.longitude, "longitude");

  const serviceDate = parseDate(payload.serviceDate, "serviceDate");
  const normalizedServiceDate = new Date(
    Date.UTC(
      serviceDate.getUTCFullYear(),
      serviceDate.getUTCMonth(),
      serviceDate.getUTCDate(),
    ),
  );

  const serviceStart = combineDateAndTime(normalizedServiceDate, normalizeString(payload.serviceStartTime), "serviceStartTime");
  const rawServiceEnd = combineDateAndTime(normalizedServiceDate, normalizeString(payload.serviceEndTime), "serviceEndTime");
  const serviceEnd = normalizeEndDate(serviceStart, rawServiceEnd);

  if (serviceEnd <= serviceStart) {
    throw new Error("La hora de término del reporte debe ser posterior a la hora de inicio");
  }

  const activities = parseActivities(payload.activities, normalizedServiceDate, serviceStart, serviceEnd);
  const totalServiceMinutes = activities.reduce((acc, activity) => acc + activity.durationMinutes, 0);

  return {
    vesselId,
    vesselName,
    captainName,
    captainId,
    clientName,
    customerId,
    patronName,
    motoristaName,
    cookName,
    sailorName,
    companySupervisorName: companySupervisorName || null,
    clientSupervisorName: clientSupervisorName || null,
    notes: notes || null,
    serviceDate: normalizedServiceDate,
    serviceStart,
    serviceEnd,
    activities,
    totalServiceMinutes,
    latitude,
    longitude,
    status,
    supportImageUrl: supportImageUrlNormalized,
    removeSupportImage,
    teamId,
  };
};

const mapActivity = (activity) => ({
  id: activity.id,
  description: activity.description,
  startedAt: activity.startedAt,
  endedAt: activity.endedAt,
  durationMinutes: minutesBetween(activity.startedAt, activity.endedAt),
  imageUrl: activity.imageUrl || null,
  latitude: activity.latitude ?? null,
  longitude: activity.longitude ?? null,
  createdAt: activity.createdAt,
  updatedAt: activity.updatedAt,
});

const mapPerson = (person) => {
  if (!person) return null;
  return {
    id: person.id,
    name: person.name,
    cedula: person.cedula,
    phone: person.phone || null,
    photoUrl: person.photoUrl || null,
    signatureUrl: person.signatureUrl || null,
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
  };
};

const mapVesselRecord = (vessel) => {
  if (!vessel) return null;
  return {
    id: vessel.id,
    name: vessel.name,
    registration: vessel.registration || null,
    vesselType: vessel.vesselType || null,
    flag: vessel.flag || null,
    owner: vessel.owner || null,
    notes: vessel.notes || null,
    createdAt: vessel.createdAt,
    updatedAt: vessel.updatedAt,
  };
};

const mapTeamCaptainAssignment = (assignment) => ({
  id: assignment.captain?.id ?? assignment.captainId,
  name: assignment.captain?.name ?? null,
  cedula: assignment.captain?.cedula ?? null,
  isPrimary: Boolean(assignment.isPrimary),
});

const mapTeamMarinerAssignment = (assignment) => ({
  id: assignment.mariner?.id ?? assignment.marinerId,
  name: assignment.mariner?.name ?? null,
  cedula: assignment.mariner?.cedula ?? null,
  role: assignment.role,
  orderIndex: assignment.orderIndex,
});

const mapTeamSummary = (team) => {
  if (!team) return null;
  return {
    id: team.id,
    name: team.name,
    description: team.description || null,
    defaultCompanySupervisorName: team.defaultCompanySupervisorName || null,
    defaultClientSupervisorName: team.defaultClientSupervisorName || null,
    isActive: team.isActive !== false,
    deactivatedAt: team.deactivatedAt || null,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
    captains: Array.isArray(team.captains) ? team.captains.map(mapTeamCaptainAssignment) : [],
    mariners: Array.isArray(team.mariners) ? team.mariners.map(mapTeamMarinerAssignment) : [],
  };
};

const buildTeamInclude = () => ({
  captains: {
    include: { captain: true },
    orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
  },
  mariners: {
    include: { mariner: true },
    orderBy: [{ role: "asc" }, { orderIndex: "asc" }, { id: "asc" }],
  },
});

const TEAM_ROLE_TO_REPORT_FIELD = {
  PATRON: "patronName",
  MOTORISTA: "motoristaName",
  COCINERO: "cookName",
  MARINERO: "sailorName",
};

const isBlank = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string") return false;
  return value.trim().length === 0;
};

const computeTeamDefaults = (team) => {
  if (!team) return null;

  const primaryCaptain = Array.isArray(team.captains)
    ? team.captains.find((assignment) => assignment.isPrimary) || team.captains[0]
    : null;

  const defaults = {
    captainId: primaryCaptain?.captainId ?? null,
    captainName: primaryCaptain?.captain?.name ?? null,
    companySupervisorName: team.defaultCompanySupervisorName || null,
    clientSupervisorName: team.defaultClientSupervisorName || null,
    patronName: null,
    motoristaName: null,
    cookName: null,
    sailorName: null,
  };

  if (Array.isArray(team.mariners)) {
    const grouped = {
      PATRON: [],
      MOTORISTA: [],
      COCINERO: [],
      MARINERO: [],
    };

    team.mariners.forEach((assignment) => {
      const role = assignment.role;
      if (!grouped[role]) return;
      const name = assignment.mariner?.name || null;
      if (name) {
        grouped[role].push(name);
      }
    });

    Object.entries(grouped).forEach(([role, names]) => {
      const field = TEAM_ROLE_TO_REPORT_FIELD[role];
      if (!field) return;
      if (names.length > 0) {
        defaults[field] = names.join(", ");
      }
    });
  }

  return defaults;
};

const mapReport = (report) => ({
  id: report.id,
  vesselId: report.vesselId || null,
  vesselName: report.vesselName,
  captainName: report.captainName,
  captainId: report.captainId || null,
  teamId: report.teamId || null,
  clientName: report.clientName,
  customerId: report.customerId || null,
  patronName: report.patronName,
  motoristaName: report.motoristaName,
  cookName: report.cookName,
  sailorName: report.sailorName,
  companySupervisorName: report.companySupervisorName || null,
  clientSupervisorName: report.clientSupervisorName || null,
  notes: report.notes || null,
  latitude: report.latitude ?? null,
  longitude: report.longitude ?? null,
  status: report.status,
  supportImageUrl: report.supportImageUrl || null,
  serviceDate: report.serviceDate,
  serviceStart: report.serviceStart,
  serviceEnd: report.serviceEnd,
  totalServiceMinutes: report.totalServiceMinutes,
  createdAt: report.createdAt,
  updatedAt: report.updatedAt,
  createdByUserId: report.createdByUserId || null,
  createdByUserFullName: report.createdByUserFullName || null,
  createdByUserEmail: report.createdByUserEmail || null,
  approvedByUserId: report.approvedByUserId ?? null,
  approvedByUserFullName: report.approvedByUserFullName || null,
  approvedByUserEmail: report.approvedByUserEmail || null,
  approvedAt: report.approvedAt ?? null,
  captain: mapPerson(report.captain),
  customer: mapPerson(report.customer),
  vessel: mapVesselRecord(report.vessel),
  team: mapTeamSummary(report.team),
  activities: (report.activities || []).sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime()).map(mapActivity),
});

const parseDateRange = (startDate, endDate) => {
  let start = startDate ? new Date(startDate) : null;
  let end = endDate ? new Date(endDate) : null;

  if (start && Number.isNaN(start.getTime())) start = null;
  if (end && Number.isNaN(end.getTime())) end = null;

  if (start && !end) {
    end = new Date(start);
    end.setHours(23, 59, 59, 999);
  }

  if (end && !start) {
    start = new Date(end);
    start.setHours(0, 0, 0, 0);
  }

  return { start, end };
};

router.get("/metrics", async (req, res) => {
  try {
    const { startDate, endDate, vessel, client } = req.query ?? {};
    const { start, end } = parseDateRange(startDate, endDate);

    const reportWhere = {};
    if (vessel) {
      reportWhere.vesselName = { contains: `${vessel}`.trim(), mode: "insensitive" };
    }
    if (client) {
      reportWhere.clientName = { contains: `${client}`.trim(), mode: "insensitive" };
    }
    if (start || end) {
      reportWhere.serviceDate = {};
      if (start) reportWhere.serviceDate.gte = start;
      if (end) reportWhere.serviceDate.lte = end;
    }

    const [reports, activeTeams, vessels, captains, mariners] = await Promise.all([
      prisma.report.findMany({
        where: reportWhere,
        select: {
          id: true,
          serviceDate: true,
          totalServiceMinutes: true,
          activities: {
            select: { startedAt: true, endedAt: true },
          },
        },
        orderBy: { serviceDate: "asc" },
      }),
      prisma.team.count({ where: { isActive: true } }),
      prisma.vessel.count(),
      prisma.captain.count(),
      prisma.mariner.count(),
    ]);

    const groupedByDate = new Map();

    reports.forEach((report) => {
      const serviceDate = report.serviceDate instanceof Date ? report.serviceDate : new Date(report.serviceDate);
      if (Number.isNaN(serviceDate.getTime())) {
        return;
      }
      const dateKey = serviceDate.toISOString().slice(0, 10);
      if (!groupedByDate.has(dateKey)) {
        groupedByDate.set(dateKey, { reports: 0, minutes: 0 });
      }
      const bucket = groupedByDate.get(dateKey);
      bucket.reports += 1;
      const minutes = Math.max(
        report.totalServiceMinutes && report.totalServiceMinutes > 0
          ? report.totalServiceMinutes
          : (report.activities || []).reduce(
              (acc, activity) => acc + minutesBetween(activity.startedAt, activity.endedAt),
              0,
            ),
        0,
      );
      bucket.minutes += minutes;
    });

    const daily = Array.from(groupedByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({
        date,
        totalReports: value.reports,
        totalMinutes: value.minutes,
      }));

    res.json({
      range: {
        start: start ? start.toISOString() : null,
        end: end ? end.toISOString() : null,
      },
      totals: {
        reports: reports.length,
        activeTeams,
        vessels,
        captains,
        mariners,
      },
      daily,
    });
  } catch (error) {
    console.error("[reports] metrics error:", error);
    res.status(500).json({ error: "No se pudieron obtener las métricas del dashboard" });
  }
});

router.get("/summary", async (req, res) => {
  try {
    const { startDate, endDate, vessel } = req.query ?? {};
    const { start, end } = parseDateRange(startDate, endDate);

    const where = {};
    if (vessel) {
      where.vesselName = { contains: `${vessel}`.trim(), mode: "insensitive" };
    }
    if (start || end) {
      where.serviceDate = {};
      if (start) where.serviceDate.gte = start;
      if (end) where.serviceDate.lte = end;
    }

    const reports = await prisma.report.findMany({
      where,
      include: { activities: true },
      orderBy: { serviceDate: "asc" },
    });

    const groupByVessel = new Map();

    reports.forEach((report) => {
      const date = new Date(report.serviceDate);
      if (Number.isNaN(date.getTime())) {
        return;
      }

      const year = date.getUTCFullYear();
      const week = getIsoWeek(date);
      const bucketKey = `${year}-W${String(week).padStart(2, "0")}`;

      if (!groupByVessel.has(report.vesselName)) {
        groupByVessel.set(report.vesselName, new Map());
      }

      const bucketMap = groupByVessel.get(report.vesselName);
      if (!bucketMap.has(bucketKey)) {
        const bucketStart = startOfISOWeek(date);
        const bucketEnd = endOfISOWeek(date);
        bucketMap.set(bucketKey, {
          label: bucketKey,
          start: bucketStart.toISOString(),
          end: bucketEnd.toISOString(),
          reports: 0,
          totalMinutes: 0,
        });
      }

      const bucket = bucketMap.get(bucketKey);
      bucket.reports += 1;
      const minutes = report.totalServiceMinutes > 0
        ? report.totalServiceMinutes
        : (report.activities || []).reduce((acc, activity) => acc + minutesBetween(activity.startedAt, activity.endedAt), 0);
      bucket.totalMinutes += minutes;
    });

    const points = Array.from(groupByVessel.entries()).map(([vesselName, buckets]) => ({
      vesselName,
      totalReports: Array.from(buckets.values()).reduce((acc, item) => acc + item.reports, 0),
      totalMinutes: Array.from(buckets.values()).reduce((acc, item) => acc + item.totalMinutes, 0),
      buckets: Array.from(buckets.values()).sort((a, b) => a.start.localeCompare(b.start)),
    }));

    res.json({
      range: {
        start: start ? start.toISOString() : null,
        end: end ? end.toISOString() : null,
      },
      points,
    });
  } catch (error) {
    console.error("[reports] summary error:", error);
    res.status(500).json({ error: "No se pudo generar el resumen de reportes" });
  }
});

router.get("/locations", async (req, res) => {
  try {
    const { startDate, endDate, vessel, client } = req.query ?? {};
    const { start, end } = parseDateRange(startDate, endDate);

    const where = {
      latitude: { not: null },
      longitude: { not: null },
    };

    if (vessel && `${vessel}`.trim()) {
      where.vesselName = { contains: `${vessel}`.trim(), mode: "insensitive" };
    }

    if (client && `${client}`.trim()) {
      where.clientName = { contains: `${client}`.trim(), mode: "insensitive" };
    }

    if (start || end) {
      where.serviceDate = {};
      if (start) where.serviceDate.gte = start;
      if (end) where.serviceDate.lte = end;
    }

    const reports = await prisma.report.findMany({
      where,
      select: {
        id: true,
        vesselName: true,
        serviceDate: true,
        latitude: true,
        longitude: true,
        clientName: true,
      },
      orderBy: { serviceDate: "desc" },
    });

    res.json({
      data: reports.map((report) => ({
        id: report.id,
        vesselName: report.vesselName,
        clientName: report.clientName,
        serviceDate: report.serviceDate,
        latitude: report.latitude,
        longitude: report.longitude,
      })),
    });
  } catch (error) {
    console.error("[reports] locations error:", error);
    res.status(500).json({ error: "No se pudo obtener las ubicaciones de los reportes" });
  }
});

router.get("/", async (req, res) => {
  try {
    const {
      search,
      vessel,
      client,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
    } = req.query ?? {};

    const currentPage = Math.max(Number.parseInt(page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(pageSize, 10) || 20, 1), 100);
    const offset = (currentPage - 1) * limit;

    const where = {};

    if (search && `${search}`.trim()) {
      const term = `${search}`.trim();
      where.OR = [
        { vesselName: { contains: term, mode: "insensitive" } },
        { captainName: { contains: term, mode: "insensitive" } },
        { clientName: { contains: term, mode: "insensitive" } },
      ];
    }

    if (vessel && `${vessel}`.trim()) {
      where.vesselName = { contains: `${vessel}`.trim(), mode: "insensitive" };
    }

    if (client && `${client}`.trim()) {
      where.clientName = { contains: `${client}`.trim(), mode: "insensitive" };
    }

    const { start, end } = parseDateRange(startDate, endDate);
    if (start || end) {
      where.serviceDate = {};
      if (start) where.serviceDate.gte = start;
      if (end) where.serviceDate.lte = end;
    }

    const [total, reports] = await Promise.all([
      prisma.report.count({ where }),
      prisma.report.findMany({
        where,
        include: {
          activities: {
            orderBy: { startedAt: "asc" },
          },
          captain: true,
          customer: true,
          vessel: true,
          team: {
            include: buildTeamInclude(),
          },
        },
        orderBy: { serviceDate: "desc" },
        skip: offset,
        take: limit,
      }),
    ]);

    res.json({
      data: reports.map(mapReport),
      meta: {
        page: currentPage,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("[reports] list error:", error);
    res.status(500).json({ error: "No se pudo obtener la lista de reportes" });
  }
});

router.get("/:id/pdf", async (req, res) => {
  const reportId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(reportId)) {
    return res.status(400).json({ error: "Identificador de reporte inválido" });
  }

  try {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        activities: {
          orderBy: { startedAt: "asc" },
        },
        captain: true,
        customer: true,
        vessel: true,
        team: {
          include: buildTeamInclude(),
        },
      },
    });

    if (!report) {
      return res.status(404).json({ error: "Reporte no encontrado" });
    }

    const html = await renderReportHtml(report);
    const filename = `reporte-${reportId}.pdf`;

    const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdfBuffer = await page.pdf({
        format: "Letter",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "12mm", bottom: "14mm", left: "12mm", right: "12mm" },
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(pdfBuffer);
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error("[reports] pdf error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "No se pudo generar el PDF del reporte" });
    } else {
      res.end();
    }
  }
});

router.post("/:id/approve", async (req, res) => {
  const reportId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(reportId)) {
    return res.status(400).json({ error: "Identificador de reporte inválido" });
  }

  try {
    const approvalUser = await ensureStaticCodeUser(req);
    const approvalMetadata = buildTwoFactorUserMetadata(approvalUser);

    const existing = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        activities: {
          orderBy: { startedAt: "asc" },
        },
        captain: true,
        customer: true,
        vessel: true,
        team: {
          include: buildTeamInclude(),
        },
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Reporte no encontrado" });
    }

    if (existing.status === "APPROVED") {
      if (!existing.approvedByUserId && (approvalMetadata.id || approvalMetadata.fullName || approvalMetadata.email)) {
        const refreshed = await prisma.report.update({
          where: { id: reportId },
          data: {
            approvedByUserId: approvalMetadata.id,
            approvedByUserFullName: approvalMetadata.fullName,
            approvedByUserEmail: approvalMetadata.email,
            approvedAt: existing.approvedAt ?? new Date(),
          },
          include: {
            activities: {
              orderBy: { startedAt: "asc" },
            },
            captain: true,
            customer: true,
            vessel: true,
            team: {
              include: buildTeamInclude(),
            },
          },
        });
        return res.json(mapReport(refreshed));
      }
      return res.json(mapReport(existing));
    }

    const updated = await prisma.report.update({
      where: { id: reportId },
      data: {
        status: "APPROVED",
        approvedByUserId: approvalMetadata.id,
        approvedByUserFullName: approvalMetadata.fullName,
        approvedByUserEmail: approvalMetadata.email,
        approvedAt: new Date(),
      },
      include: {
        activities: {
          orderBy: { startedAt: "asc" },
        },
        captain: true,
        customer: true,
        vessel: true,
        team: {
          include: buildTeamInclude(),
        },
      },
    });

    return res.json(mapReport(updated));
  } catch (error) {
    if (error?.name === "TwoFactorValidationError" && typeof error.statusCode === "number") {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("[reports] approve error:", error);
    return res.status(500).json({ error: "No se pudo aprobar el reporte" });
  }
});

router.get("/:id", async (req, res) => {
  const reportId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(reportId)) {
    return res.status(400).json({ error: "Identificador de reporte inválido" });
  }

  try {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        activities: {
          orderBy: { startedAt: "asc" },
        },
        captain: true,
        customer: true,
        vessel: true,
        team: {
          include: buildTeamInclude(),
        },
      },
    });

    if (!report) {
      return res.status(404).json({ error: "Reporte no encontrado" });
    }

    return res.json(mapReport(report));
  } catch (error) {
    console.error("[reports] get error:", error);
    return res.status(500).json({ error: "No se pudo obtener el reporte" });
  }
});

router.post("/", upload.any(), async (req, res) => {
  const uploadedFiles = Array.isArray(req.files)
    ? req.files.map((file) => path.resolve(file.destination, file.filename))
    : [];

  try {
    const authorizedUser = await ensureStaticCodeUser(req);
    const authorizedMetadata = buildTwoFactorUserMetadata(authorizedUser);
    const payload = parseReportPayload(req.body?.data ?? req.body);
    const fileMap = buildFileMap(req.files);

    const activitiesData = payload.activities.map((activity) => {
      const file = fileMap.get(activity.fileField);
      return {
        description: activity.description,
        startedAt: activity.startedAt,
        endedAt: activity.endedAt,
        imageUrl: file ? toPublicImagePath(file.filename) : null,
        latitude: activity.latitude ?? null,
        longitude: activity.longitude ?? null,
      };
    });

    const supportFile = fileMap.get("supportFile");
    let supportImageUrl = payload.supportImageUrl || null;
    if (supportFile) {
      supportImageUrl = toPublicImagePath(supportFile.filename);
    } else if (payload.removeSupportImage) {
      supportImageUrl = null;
    }

    let resolvedVesselId = payload.vesselId || null;
    let resolvedVesselName = payload.vesselName;
    if (resolvedVesselId) {
      const vessel = await prisma.vessel.findUnique({ where: { id: resolvedVesselId } });
      if (!vessel) {
        throw new Error("La embarcación seleccionada no existe");
      }
      resolvedVesselName = vessel.name;
    } else {
      resolvedVesselId = null;
    }

    let resolvedCaptainId = payload.captainId || null;
    let resolvedCaptainName = payload.captainName;
    let resolvedCustomerId = payload.customerId || null;
    let resolvedClientName = payload.clientName;
    let resolvedPatronName = payload.patronName;
    let resolvedMotoristaName = payload.motoristaName;
    let resolvedCookName = payload.cookName;
    let resolvedSailorName = payload.sailorName;
    let resolvedCompanySupervisorName = payload.companySupervisorName;
    let resolvedClientSupervisorName = payload.clientSupervisorName;
    let resolvedTeamId = payload.teamId || null;

    if (resolvedTeamId) {
      const team = await prisma.team.findUnique({
        where: { id: resolvedTeamId },
        include: buildTeamInclude(),
      });
      if (!team) {
        throw new Error("El equipo seleccionado no existe");
      }

      const defaults = computeTeamDefaults(team);
      if (defaults) {
        if (!resolvedCaptainId && defaults.captainId) {
          resolvedCaptainId = defaults.captainId;
        }
        if (isBlank(resolvedCaptainName) && defaults.captainName) {
          resolvedCaptainName = defaults.captainName;
        }
        if (isBlank(resolvedPatronName) && defaults.patronName) {
          resolvedPatronName = defaults.patronName;
        }
        if (isBlank(resolvedMotoristaName) && defaults.motoristaName) {
          resolvedMotoristaName = defaults.motoristaName;
        }
        if (isBlank(resolvedCookName) && defaults.cookName) {
          resolvedCookName = defaults.cookName;
        }
        if (isBlank(resolvedSailorName) && defaults.sailorName) {
          resolvedSailorName = defaults.sailorName;
        }
        if (isBlank(resolvedCompanySupervisorName) && defaults.companySupervisorName) {
          resolvedCompanySupervisorName = defaults.companySupervisorName;
        }
        if (isBlank(resolvedClientSupervisorName) && defaults.clientSupervisorName) {
          resolvedClientSupervisorName = defaults.clientSupervisorName;
        }
      }
    } else {
      resolvedTeamId = null;
    }

    if (resolvedCaptainId) {
      const captain = await prisma.captain.findUnique({ where: { id: resolvedCaptainId } });
      if (!captain) {
        throw new Error("El capitán seleccionado no existe");
      }
      resolvedCaptainName = captain.name;
    } else {
      resolvedCaptainId = null;
    }

    if (isBlank(resolvedCaptainName)) {
      throw new Error("Debes especificar un capitán para el reporte");
    }

    if (resolvedCustomerId) {
      const customer = await prisma.customer.findUnique({ where: { id: resolvedCustomerId } });
      if (!customer) {
        throw new Error("El cliente seleccionado no existe");
      }
      resolvedClientName = customer.name;
    } else {
      resolvedCustomerId = null;
    }

    resolvedCaptainName = `${resolvedCaptainName}`.trim();
    resolvedPatronName = isBlank(resolvedPatronName) ? "" : resolvedPatronName;
    resolvedMotoristaName = isBlank(resolvedMotoristaName) ? "" : resolvedMotoristaName;
    resolvedCookName = isBlank(resolvedCookName) ? "" : resolvedCookName;
    resolvedSailorName = isBlank(resolvedSailorName) ? "" : resolvedSailorName;
    resolvedCompanySupervisorName = isBlank(resolvedCompanySupervisorName)
      ? null
      : `${resolvedCompanySupervisorName}`.trim();
    resolvedClientSupervisorName = isBlank(resolvedClientSupervisorName)
      ? null
      : `${resolvedClientSupervisorName}`.trim();

    const report = await prisma.report.create({
      data: {
        vesselId: resolvedVesselId,
        vesselName: resolvedVesselName,
        captainName: resolvedCaptainName,
        captainId: resolvedCaptainId,
        clientName: resolvedClientName,
        customerId: resolvedCustomerId,
        patronName: resolvedPatronName,
        motoristaName: resolvedMotoristaName,
        cookName: resolvedCookName,
        sailorName: resolvedSailorName,
        companySupervisorName: resolvedCompanySupervisorName,
        clientSupervisorName: resolvedClientSupervisorName,
        notes: payload.notes,
        serviceDate: payload.serviceDate,
        serviceStart: payload.serviceStart,
        serviceEnd: payload.serviceEnd,
        latitude: payload.latitude,
        longitude: payload.longitude,
        totalServiceMinutes: payload.totalServiceMinutes,
        status: payload.status,
        supportImageUrl,
        teamId: resolvedTeamId,
        createdByUserId: authorizedMetadata.id,
        createdByUserFullName: authorizedMetadata.fullName,
        createdByUserEmail: authorizedMetadata.email,
        activities: {
          create: activitiesData,
        },
      },
      include: {
        activities: {
          orderBy: { startedAt: "asc" },
        },
        captain: true,
        customer: true,
        vessel: true,
        team: {
          include: buildTeamInclude(),
        },
      },
    });

    return res.status(201).json(mapReport(report));
  } catch (error) {
    cleanupUploadedFiles(uploadedFiles);
    if (error?.name === "TwoFactorValidationError" && typeof error.statusCode === "number") {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("[reports] create error:", error);
    return res.status(400).json({ error: error.message || "No se pudo crear el reporte" });
  }
});

router.put("/:id", upload.any(), async (req, res) => {
  const reportId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(reportId)) {
    cleanupUploadedFiles(
      Array.isArray(req.files) ? req.files.map((file) => path.resolve(file.destination, file.filename)) : []
    );
    return res.status(400).json({ error: "Identificador de reporte inválido" });
  }

  const uploadedFiles = Array.isArray(req.files)
    ? req.files.map((file) => path.resolve(file.destination, file.filename))
    : [];

  try {
    const existing = await prisma.report.findUnique({
      where: { id: reportId },
      include: { activities: true },
    });

    if (!existing) {
      cleanupUploadedFiles(uploadedFiles);
      return res.status(404).json({ error: "Reporte no encontrado" });
    }

    const payload = parseReportPayload(req.body?.data ?? req.body);
    const fileMap = buildFileMap(req.files);
    const supportEvidenceFile = fileMap.get("supportFile");

    let resolvedVesselId = payload.vesselId || null;
    let resolvedVesselName = payload.vesselName;
    if (resolvedVesselId) {
      const vessel = await prisma.vessel.findUnique({ where: { id: resolvedVesselId } });
      if (!vessel) {
        throw new Error("La embarcación seleccionada no existe");
      }
      resolvedVesselName = vessel.name;
    } else {
      resolvedVesselId = null;
    }

    let resolvedCaptainId = payload.captainId || null;
    let resolvedCaptainName = payload.captainName;
    let resolvedCustomerId = payload.customerId || null;
    let resolvedClientName = payload.clientName;
    let resolvedPatronName = payload.patronName;
    let resolvedMotoristaName = payload.motoristaName;
    let resolvedCookName = payload.cookName;
    let resolvedSailorName = payload.sailorName;
    let resolvedCompanySupervisorName = payload.companySupervisorName;
    let resolvedClientSupervisorName = payload.clientSupervisorName;
    let resolvedTeamId = payload.teamId || null;

    if (resolvedTeamId) {
      const team = await prisma.team.findUnique({
        where: { id: resolvedTeamId },
        include: buildTeamInclude(),
      });
      if (!team) {
        throw new Error("El equipo seleccionado no existe");
      }

      const defaults = computeTeamDefaults(team);
      if (defaults) {
        if (!resolvedCaptainId && defaults.captainId) {
          resolvedCaptainId = defaults.captainId;
        }
        if (isBlank(resolvedCaptainName) && defaults.captainName) {
          resolvedCaptainName = defaults.captainName;
        }
        if (isBlank(resolvedPatronName) && defaults.patronName) {
          resolvedPatronName = defaults.patronName;
        }
        if (isBlank(resolvedMotoristaName) && defaults.motoristaName) {
          resolvedMotoristaName = defaults.motoristaName;
        }
        if (isBlank(resolvedCookName) && defaults.cookName) {
          resolvedCookName = defaults.cookName;
        }
        if (isBlank(resolvedSailorName) && defaults.sailorName) {
          resolvedSailorName = defaults.sailorName;
        }
        if (isBlank(resolvedCompanySupervisorName) && defaults.companySupervisorName) {
          resolvedCompanySupervisorName = defaults.companySupervisorName;
        }
        if (isBlank(resolvedClientSupervisorName) && defaults.clientSupervisorName) {
          resolvedClientSupervisorName = defaults.clientSupervisorName;
        }
      }
    } else {
      resolvedTeamId = null;
    }

    if (resolvedCaptainId) {
      const captain = await prisma.captain.findUnique({ where: { id: resolvedCaptainId } });
      if (!captain) {
        throw new Error("El capitán seleccionado no existe");
      }
      resolvedCaptainName = captain.name;
    } else {
      resolvedCaptainId = null;
    }

    if (isBlank(resolvedCaptainName)) {
      throw new Error("Debes especificar un capitán para el reporte");
    }

    if (resolvedCustomerId) {
      const customer = await prisma.customer.findUnique({ where: { id: resolvedCustomerId } });
      if (!customer) {
        throw new Error("El cliente seleccionado no existe");
      }
      resolvedClientName = customer.name;
    } else {
      resolvedCustomerId = null;
    }

    resolvedCaptainName = `${resolvedCaptainName}`.trim();
    resolvedPatronName = isBlank(resolvedPatronName) ? "" : resolvedPatronName;
    resolvedMotoristaName = isBlank(resolvedMotoristaName) ? "" : resolvedMotoristaName;
    resolvedCookName = isBlank(resolvedCookName) ? "" : resolvedCookName;
    resolvedSailorName = isBlank(resolvedSailorName) ? "" : resolvedSailorName;
    resolvedCompanySupervisorName = isBlank(resolvedCompanySupervisorName)
      ? null
      : `${resolvedCompanySupervisorName}`.trim();
    resolvedClientSupervisorName = isBlank(resolvedClientSupervisorName)
      ? null
      : `${resolvedClientSupervisorName}`.trim();

    const existingActivitiesMap = new Map(
      existing.activities.map((activity) => [activity.id, activity])
    );

    const activitiesToCreate = [];
    const activitiesToUpdate = [];
    const activitiesToDelete = [];
    const imagesToRemove = [];

    let nextSupportImageUrl = existing.supportImageUrl;
    if (supportEvidenceFile) {
      imagesToRemove.push(toAbsoluteImagePath(existing.supportImageUrl));
      nextSupportImageUrl = toPublicImagePath(supportEvidenceFile.filename);
    } else if (payload.removeSupportImage) {
      imagesToRemove.push(toAbsoluteImagePath(existing.supportImageUrl));
      nextSupportImageUrl = null;
    } else if (payload.supportImageUrl) {
      nextSupportImageUrl = payload.supportImageUrl;
    }

    payload.activities.forEach((activity) => {
      const file = fileMap.get(activity.fileField);
      if (activity.id) {
        const current = existingActivitiesMap.get(activity.id);
        if (!current) {
          throw new Error("Una de las actividades a actualizar no existe");
        }
        existingActivitiesMap.delete(activity.id);

        const data = {
          description: activity.description,
          startedAt: activity.startedAt,
          endedAt: activity.endedAt,
          latitude: activity.latitude ?? null,
          longitude: activity.longitude ?? null,
        };

        if (file) {
          if (current.imageUrl) {
            imagesToRemove.push(toAbsoluteImagePath(current.imageUrl));
          }
          data.imageUrl = toPublicImagePath(file.filename);
        } else if (activity.removeImage) {
          if (current.imageUrl) {
            imagesToRemove.push(toAbsoluteImagePath(current.imageUrl));
          }
          data.imageUrl = null;
        } else {
          data.imageUrl = current.imageUrl;
        }

        activitiesToUpdate.push({ id: activity.id, data });
      } else {
        activitiesToCreate.push({
          description: activity.description,
          startedAt: activity.startedAt,
          endedAt: activity.endedAt,
          imageUrl: file ? toPublicImagePath(file.filename) : null,
          latitude: activity.latitude ?? null,
          longitude: activity.longitude ?? null,
        });
      }
    });

    existingActivitiesMap.forEach((activity) => {
      activitiesToDelete.push(activity);
      if (activity.imageUrl) {
        imagesToRemove.push(toAbsoluteImagePath(activity.imageUrl));
      }
    });

    await prisma.$transaction(async (tx) => {
      await tx.report.update({
        where: { id: reportId },
        data: {
          vesselId: resolvedVesselId,
          vesselName: resolvedVesselName,
          captainName: resolvedCaptainName,
          captainId: resolvedCaptainId,
          clientName: resolvedClientName,
          customerId: resolvedCustomerId,
          patronName: resolvedPatronName,
          motoristaName: resolvedMotoristaName,
          cookName: resolvedCookName,
          sailorName: resolvedSailorName,
          companySupervisorName: resolvedCompanySupervisorName,
          clientSupervisorName: resolvedClientSupervisorName,
          notes: payload.notes,
          serviceDate: payload.serviceDate,
          serviceStart: payload.serviceStart,
          serviceEnd: payload.serviceEnd,
          latitude: payload.latitude,
          longitude: payload.longitude,
          totalServiceMinutes: payload.totalServiceMinutes,
          status: payload.status,
          supportImageUrl: nextSupportImageUrl,
          teamId: resolvedTeamId,
        },
      });

      await Promise.all(
        activitiesToUpdate.map((item) =>
          tx.reportActivity.update({
            where: { id: item.id },
            data: item.data,
          })
        )
      );

      if (activitiesToCreate.length > 0) {
        await Promise.all(
          activitiesToCreate.map((item) =>
            tx.reportActivity.create({
              data: {
                ...item,
                reportId,
              },
            })
          )
        );
      }

      if (activitiesToDelete.length > 0) {
        await tx.reportActivity.deleteMany({
          where: { id: { in: activitiesToDelete.map((item) => item.id) } },
        });
      }
    });

    imagesToRemove.forEach((filePath) => deleteFileIfExists(filePath));

    const updated = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        activities: {
          orderBy: { startedAt: "asc" },
        },
        captain: true,
        customer: true,
        vessel: true,
        team: {
          include: buildTeamInclude(),
        },
      },
    });

    return res.json(mapReport(updated));
  } catch (error) {
    cleanupUploadedFiles(uploadedFiles);
    console.error("[reports] update error:", error);
    return res.status(400).json({ error: error.message || "No se pudo actualizar el reporte" });
  }
});

router.delete("/:id", async (req, res) => {
  const reportId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(reportId)) {
    return res.status(400).json({ error: "Identificador de reporte inválido" });
  }

  try {
    const existing = await prisma.report.findUnique({
      where: { id: reportId },
      include: { activities: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Reporte no encontrado" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.reportActivity.deleteMany({ where: { reportId } });
      await tx.report.delete({ where: { id: reportId } });
    });

    existing.activities.forEach((activity) => {
      if (activity.imageUrl) {
        deleteFileIfExists(toAbsoluteImagePath(activity.imageUrl));
      }
    });

    if (existing.supportImageUrl) {
      deleteFileIfExists(toAbsoluteImagePath(existing.supportImageUrl));
    }

    return res.status(204).send();
  } catch (error) {
    console.error("[reports] delete error:", error);
    return res.status(500).json({ error: "No se pudo eliminar el reporte" });
  }
});

function getIsoWeek(date) {
  const tempDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = tempDate.getUTCDay() || 7;
  tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
  return Math.ceil(((tempDate - yearStart) / 86400000 + 1) / 7);
}

function startOfISOWeek(date) {
  const tempDate = new Date(date);
  const day = tempDate.getUTCDay() || 7;
  if (day !== 1) {
    tempDate.setUTCDate(tempDate.getUTCDate() - day + 1);
  }
  tempDate.setUTCHours(0, 0, 0, 0);
  return tempDate;
}

function endOfISOWeek(date) {
  const tempDate = new Date(date);
  const day = tempDate.getUTCDay() || 7;
  if (day !== 7) {
    tempDate.setUTCDate(tempDate.getUTCDate() + (7 - day));
  }
  tempDate.setUTCHours(23, 59, 59, 999);
  return tempDate;
}

export default router;
