import { Router } from "express";
import { Prisma, PrismaClient } from "@prisma/client";
import path from "path";
import { promises as fs } from "fs";
import Handlebars from "handlebars";
import puppeteer from "puppeteer";

const router = Router();
const prisma = new PrismaClient();

const TEMPLATE_PATH = path.resolve(process.cwd(), "templates", "valuation.html");
const PDF_OPTIONS = {
  format: "A4",
  landscape: true,
  printBackground: true,
  margin: { top: "10mm", bottom: "12mm", left: "12mm", right: "12mm" },
};

let valuationTemplateCache = {
  compiled: null,
  mtimeMs: null,
};

const VALUATION_STATUS_SET = new Set(["DRAFT", "SENT", "APPROVED", "REJECTED", "CANCELLED"]);
const STATUS_LABELS = {
  DRAFT: "Borrador",
  SENT: "Enviado",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
};

const DEFAULT_COMPANY = {
  name: "LagoReport",
  taxId: "RIF: J-00000000-0",
  address: "Dirección principal",
  phone: "",
  email: "",
};

const DEFAULT_LOGO_PATH = path.resolve(process.cwd(), "public", "logoreporte.jpg");
let defaultLogoDataUriPromise = null;

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

async function getDefaultLogoDataUri() {
  if (!defaultLogoDataUriPromise) {
    defaultLogoDataUriPromise = fs
      .readFile(DEFAULT_LOGO_PATH)
      .then((buffer) => {
        const extension = path.extname(DEFAULT_LOGO_PATH).toLowerCase();
        const mimeType = imageExtensionToMime(extension);
        return `data:${mimeType};base64,${buffer.toString("base64")}`;
      })
      .catch(() => null);
  }
  return defaultLogoDataUriPromise;
}

async function toDataUriFromImagePath(publicPath) {
  if (!publicPath) return null;
  if (isDataUri(publicPath)) return publicPath;

  if (isHttpUrl(publicPath)) {
    if (typeof fetch !== "function") {
      console.warn("[valuations] fetch no disponible para obtener imagen remota", publicPath);
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
      const message = error instanceof Error ? error.message : "Error desconocido";
      console.warn("[valuations] no se pudo obtener la imagen remota", publicPath, message);
      return null;
    }
  }

  const absolutePath = toAbsoluteImagePath(publicPath);
  if (!absolutePath) return null;

  try {
    const buffer = await fs.readFile(absolutePath);
    const extension = path.extname(absolutePath).toLowerCase();
    const mimeType = imageExtensionToMime(extension);
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.warn("[valuations] no se pudo cargar la imagen", absolutePath, message);
    return null;
  }
}

async function getCompanyBranding() {
  let company = { ...DEFAULT_COMPANY };
  try {
    const branding = await prisma.brandingSetting.findFirst();
    if (branding) {
      company = {
        ...company,
        name: branding.legalName ?? company.name,
        taxId: branding.taxId ?? company.taxId,
        address: branding.address ?? company.address,
        phone: branding.phone ?? company.phone,
      };

      if (branding.pdfLogoUrl) {
        const logoDataUri = await toDataUriFromImagePath(branding.pdfLogoUrl);
        if (logoDataUri) {
          return { ...company, logoDataUri };
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.warn("[valuations] no se pudo cargar el branding", message);
  }

  const fallbackLogo = await getDefaultLogoDataUri();
  return { ...company, logoDataUri: fallbackLogo };
}

const numberFormatterUsd = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const numberFormatterGeneric = (currency) =>
  new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
  });

const dateFormatter = new Intl.DateTimeFormat("es-VE", {
  dateStyle: "medium",
});

const decimalToNumber = (value) => {
  if (value === undefined || value === null) return null;
  try {
    return Number(value);
  } catch (error) {
    return null;
  }
};

const normalizeString = (value, { required = false, fallback = null, maxLength = 255 } = {}) => {
  if (value === undefined || value === null) {
    if (required) {
      throw new Error("Campo requerido");
    }
    return fallback;
  }
  const text = `${value}`.trim();
  if (!text) {
    if (required) {
      throw new Error("Campo requerido");
    }
    return fallback;
  }
  if (text.length > maxLength) {
    throw new Error(`El texto excede los ${maxLength} caracteres permitidos`);
  }
  return text;
};

const parseInteger = (value, field, { required = false } = {}) => {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new Error(`${field} es requerido`);
    }
    return null;
  }

  const numeric = Number.parseInt(value, 10);
  if (Number.isNaN(numeric)) {
    throw new Error(`${field} debe ser un entero válido`);
  }
  return numeric;
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

const parseDate = (value, field) => {
  if (!value) {
    throw new Error(`${field} es requerido`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} no es una fecha válida`);
  }
  return date;
};

const parseStatus = (value) => {
  const normalized = `${value ?? ""}`.trim().toUpperCase();
  if (!normalized) {
    return "DRAFT";
  }
  if (!VALUATION_STATUS_SET.has(normalized)) {
    throw new Error("Estado de valuación inválido");
  }
  return normalized;
};

const toDecimal = (value) => {
  if (value === undefined || value === null) return null;
  return new Prisma.Decimal(value);
};

const mapItem = (item) => ({
  id: item.id,
  serviceId: item.serviceId,
  description: item.description,
  unit: item.unit,
  quantity: Number(item.quantity),
  unitPriceUsd: decimalToNumber(item.unitPriceUsd),
  unitPriceLocal: decimalToNumber(item.unitPriceLocal),
  totalUsd: decimalToNumber(item.totalUsd),
  totalLocal: decimalToNumber(item.totalLocal),
  orderIndex: item.orderIndex,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  service: item.service
    ? {
        id: item.service.id,
        code: item.service.code,
        name: item.service.name,
        unit: item.service.unit,
      }
    : null,
});

const mapValuation = (valuation) => ({
  id: valuation.id,
  code: valuation.code,
  title: valuation.title,
  status: valuation.status,
  customerId: valuation.customerId,
  customerName: valuation.customerName,
  customerContact: valuation.customerContact,
  customerCode: valuation.customerCode,
  customerAddress: valuation.customerAddress,
  customerEmail: valuation.customerEmail,
  customerPhone: valuation.customerPhone,
  issueDate: valuation.issueDate,
  dueDate: valuation.dueDate,
  wellCode: valuation.wellCode,
  drillCode: valuation.drillCode,
  scope: valuation.scope,
  workOrderNumber: valuation.workOrderNumber,
  referenceNumber: valuation.referenceNumber,
  paymentTerms: valuation.paymentTerms,
  currency: valuation.currency,
  localCurrency: valuation.localCurrency,
  exchangeRate: decimalToNumber(valuation.exchangeRate),
  subtotalUsd: decimalToNumber(valuation.subtotalUsd) ?? 0,
  subtotalLocal: decimalToNumber(valuation.subtotalLocal),
  taxRate: decimalToNumber(valuation.taxRate),
  taxUsd: decimalToNumber(valuation.taxUsd),
  taxLocal: decimalToNumber(valuation.taxLocal),
  totalUsd: decimalToNumber(valuation.totalUsd) ?? 0,
  totalLocal: decimalToNumber(valuation.totalLocal),
  notes: valuation.notes,
  terms: valuation.terms,
  preparedBy: valuation.preparedBy,
  approvedBy: valuation.approvedBy,
  receivedBy: valuation.receivedBy,
  receivedId: valuation.receivedId,
  createdAt: valuation.createdAt,
  updatedAt: valuation.updatedAt,
  customer: valuation.customer
    ? {
        id: valuation.customer.id,
        name: valuation.customer.name,
        cedula: valuation.customer.cedula,
        phone: valuation.customer.phone,
      }
    : null,
  items: Array.isArray(valuation.items) ? valuation.items.map(mapItem) : [],
});

async function getValuationTemplate() {
  const stats = await fs.stat(TEMPLATE_PATH);
  if (!valuationTemplateCache.compiled || valuationTemplateCache.mtimeMs !== stats.mtimeMs) {
    const content = await fs.readFile(TEMPLATE_PATH, "utf-8");
    valuationTemplateCache = {
      compiled: Handlebars.compile(content),
      mtimeMs: stats.mtimeMs,
    };
  }
  return valuationTemplateCache.compiled;
}

async function renderValuationHtml(valuation) {
  const template = await getValuationTemplate();
  const company = await getCompanyBranding();
  let localFormatter = null;
  if (valuation.localCurrency) {
    try {
      localFormatter = numberFormatterGeneric(valuation.localCurrency);
    } catch (error) {
      localFormatter = null;
    }
  }

  const context = {
    company,
    valuation: {
      code: valuation.code,
      title: valuation.title,
      statusLabel: STATUS_LABELS[valuation.status] ?? valuation.status,
      issueDateLabel: valuation.issueDate ? dateFormatter.format(new Date(valuation.issueDate)) : "",
      dueDateLabel: valuation.dueDate ? dateFormatter.format(new Date(valuation.dueDate)) : "",
      customerName: valuation.customerName ?? valuation.customer?.name ?? "",
      customerContact: valuation.customerContact ?? "",
      customerCode: valuation.customerCode ?? "",
      customerAddress: valuation.customerAddress ?? "",
      customerEmail: valuation.customerEmail ?? "",
      customerPhone: valuation.customerPhone ?? "",
      wellCode: valuation.wellCode ?? "",
      drillCode: valuation.drillCode ?? "",
      scope: valuation.scope ?? "",
      workOrderNumber: valuation.workOrderNumber ?? "",
      referenceNumber: valuation.referenceNumber ?? "",
      paymentTerms: valuation.paymentTerms ?? "",
      preparedBy: valuation.preparedBy ?? "",
      approvedBy: valuation.approvedBy ?? "",
      receivedBy: valuation.receivedBy ?? "",
      receivedId: valuation.receivedId ?? "",
      exchangeRateLabel:
        valuation.exchangeRate !== null && valuation.exchangeRate !== undefined
          ? `1 ${valuation.currency} = ${valuation.exchangeRate.toFixed(2)} ${valuation.localCurrency ?? ""}`
          : "",
      totals: {
        subtotalUsd: numberFormatterUsd.format(valuation.subtotalUsd ?? 0),
        taxUsd: numberFormatterUsd.format(valuation.taxUsd ?? 0),
        totalUsd: numberFormatterUsd.format(valuation.totalUsd ?? 0),
        subtotalLocal:
          valuation.subtotalLocal !== null && valuation.subtotalLocal !== undefined && localFormatter
            ? localFormatter.format(valuation.subtotalLocal)
            : null,
        taxLocal:
          valuation.taxLocal !== null && valuation.taxLocal !== undefined && localFormatter
            ? localFormatter.format(valuation.taxLocal)
            : null,
        totalLocal:
          valuation.totalLocal !== null && valuation.totalLocal !== undefined && localFormatter
            ? localFormatter.format(valuation.totalLocal)
            : null,
      },
      notes: valuation.notes ?? "",
      terms: valuation.terms ?? "",
      items: valuation.items.map((item, index) => ({
        index: index + 1,
        description: item.description,
        unit: item.unit,
        quantity: Number(item.quantity).toFixed(2),
        unitPriceUsd: numberFormatterUsd.format(item.unitPriceUsd ?? 0),
        totalUsd: numberFormatterUsd.format(item.totalUsd ?? 0),
        unitPriceLocal:
          item.unitPriceLocal !== null && item.unitPriceLocal !== undefined && localFormatter
            ? localFormatter.format(item.unitPriceLocal)
            : null,
        totalLocal:
          item.totalLocal !== null && item.totalLocal !== undefined && localFormatter
            ? localFormatter.format(item.totalLocal)
            : null,
      })),
    },
    generatedAt: dateFormatter.format(new Date()),
  };

  return template(context);
}

async function generateValuationCode() {
  let next = (await prisma.valuation.count()) + 1;
  while (true) {
    const candidate = `VAL-${String(next).padStart(4, "0")}`;
    const existing = await prisma.valuation.findUnique({ where: { code: candidate } });
    if (!existing) {
      return candidate;
    }
    next += 1;
  }
}

async function normalizeValuationPayload(payload, { allowEmptyItems = false } = {}) {
  const data = payload ?? {};

  const title = normalizeString(data.title, { required: true, maxLength: 150 });
  const status = parseStatus(data.status);
  const customerId = parseInteger(data.customerId, "Cliente");
  const customerName = normalizeString(data.customerName, { fallback: null, maxLength: 150 });
  const customerContact = normalizeString(data.customerContact, { fallback: null, maxLength: 120 });
  const customerCode = normalizeString(data.customerCode, { fallback: null, maxLength: 60 });
  const customerAddress = normalizeString(data.customerAddress, { fallback: null, maxLength: 250 });
  const customerEmail = normalizeString(data.customerEmail, { fallback: null, maxLength: 120 });
  const customerPhone = normalizeString(data.customerPhone, { fallback: null, maxLength: 60 });
  const issueDate = parseDate(data.issueDate, "Fecha de emisión");
  const dueDate = data.dueDate ? parseDate(data.dueDate, "Fecha de vencimiento") : null;
  const wellCode = normalizeString(data.wellCode, { fallback: null, maxLength: 60 });
  const drillCode = normalizeString(data.drillCode, { fallback: null, maxLength: 60 });
  const scope = normalizeString(data.scope, { fallback: null, maxLength: 300 });
  const workOrderNumber = normalizeString(data.workOrderNumber, { fallback: null, maxLength: 60 });
  const referenceNumber = normalizeString(data.referenceNumber, { fallback: null, maxLength: 60 });
  const paymentTerms = normalizeString(data.paymentTerms, { fallback: null, maxLength: 120 });
  const currency = normalizeString(data.currency, { fallback: "USD", maxLength: 8 }) ?? "USD";
  const localCurrency = normalizeString(data.localCurrency, { fallback: null, maxLength: 8 });
  const exchangeRate = parseDecimal(data.exchangeRate, "Tasa de cambio", { defaultValue: null });
  const taxRate = parseDecimal(data.taxRate, "Impuesto", { defaultValue: null });
  const notes = normalizeString(data.notes, { fallback: null, maxLength: 1000 });
  const terms = normalizeString(data.terms, { fallback: null, maxLength: 1000 });
  const preparedBy = normalizeString(data.preparedBy, { fallback: null, maxLength: 120 });
  const approvedBy = normalizeString(data.approvedBy, { fallback: null, maxLength: 120 });
  const receivedBy = normalizeString(data.receivedBy, { fallback: null, maxLength: 120 });
  const receivedId = normalizeString(data.receivedId, { fallback: null, maxLength: 60 });

  const itemsRaw = Array.isArray(data.items) ? data.items : [];
  if (!allowEmptyItems && itemsRaw.length === 0) {
    throw new Error("Debe agregar al menos un servicio a la valuación");
  }

  const serviceIds = itemsRaw
    .map((item) => parseInteger(item.serviceId, "Servicio"))
    .filter((value) => value !== null);

  const uniqueServiceIds = Array.from(new Set(serviceIds));
  const services = uniqueServiceIds.length
    ? await prisma.service.findMany({ where: { id: { in: uniqueServiceIds } } })
    : [];
  const serviceMap = new Map(services.map((service) => [service.id, service]));

  let subtotalUsd = 0;
  let subtotalLocal = 0;
  let hasLocalTotals = false;

  const items = itemsRaw.map((itemRaw, index) => {
    const serviceId = parseInteger(itemRaw.serviceId, "Servicio");
    const service = serviceId ? serviceMap.get(serviceId) : null;

    if (serviceId && !service) {
      throw new Error(`El servicio con id ${serviceId} no existe`);
    }

    const description = normalizeString(itemRaw.description, {
      required: !service,
      fallback: service ? service.name : null,
      maxLength: 250,
    });

    const unit = normalizeString(itemRaw.unit, {
      required: !service,
      fallback: service ? service.unit : null,
      maxLength: 20,
    });

    if (!description) {
      throw new Error(`La descripción del servicio en la línea ${index + 1} es obligatoria`);
    }
    if (!unit) {
      throw new Error(`La unidad del servicio en la línea ${index + 1} es obligatoria`);
    }

    const quantity = parseDecimal(itemRaw.quantity, "Cantidad", { required: true });
    const unitPriceUsd = parseDecimal(itemRaw.unitPriceUsd ?? service?.unitPriceUsd, "Precio USD", {
      required: true,
    });

    const unitPriceLocal = parseDecimal(itemRaw.unitPriceLocal ?? service?.unitPriceLocal, "Precio local", {
      defaultValue:
        exchangeRate !== null && exchangeRate !== undefined ? Number((unitPriceUsd * exchangeRate).toFixed(2)) : null,
    });

    const totalUsd = parseDecimal(itemRaw.totalUsd, "Total USD", {
      defaultValue: Number((unitPriceUsd * quantity).toFixed(2)),
    });

    const totalLocal = parseDecimal(itemRaw.totalLocal, "Total local", {
      defaultValue:
        unitPriceLocal !== null && unitPriceLocal !== undefined
          ? Number((unitPriceLocal * quantity).toFixed(2))
          : null,
    });

    subtotalUsd += totalUsd ?? 0;

    if (totalLocal !== null && totalLocal !== undefined) {
      subtotalLocal += totalLocal;
      hasLocalTotals = true;
    }

    return {
      serviceId,
      description,
      unit,
      quantity,
      unitPriceUsd,
      unitPriceLocal,
      totalUsd,
      totalLocal,
      orderIndex: index,
    };
  });

  const taxUsd = taxRate !== null && taxRate !== undefined ? Number(((subtotalUsd * taxRate) / 100).toFixed(2)) : null;
  const taxLocal =
    taxRate !== null && taxRate !== undefined && hasLocalTotals
      ? Number((((subtotalLocal ?? 0) * taxRate) / 100).toFixed(2))
      : null;

  const totalUsd = Number((subtotalUsd + (taxUsd ?? 0)).toFixed(2));
  const totalLocal = hasLocalTotals ? Number(((subtotalLocal ?? 0) + (taxLocal ?? 0)).toFixed(2)) : null;

  return {
    code: normalizeString(data.code, { fallback: null, maxLength: 60 }),
    title,
    status,
    customerId,
    customerName,
    customerContact,
    customerCode,
    customerAddress,
    customerEmail,
    customerPhone,
    issueDate,
    dueDate,
    wellCode,
    drillCode,
    scope,
    workOrderNumber,
    referenceNumber,
    paymentTerms,
    currency,
    localCurrency,
    exchangeRate,
    taxRate,
    subtotalUsd: Number(subtotalUsd.toFixed(2)),
    subtotalLocal: hasLocalTotals ? Number((subtotalLocal ?? 0).toFixed(2)) : null,
    taxUsd,
    taxLocal,
    totalUsd,
    totalLocal,
    notes,
    terms,
    preparedBy,
    approvedBy,
    receivedBy,
    receivedId,
    items,
  };
}

function buildSearchWhere(query) {
  const { search, status, customerId, startDate, endDate } = query;
  const where = {};

  if (status && VALUATION_STATUS_SET.has(String(status).toUpperCase())) {
    where.status = String(status).toUpperCase();
  }

  const customerIdParsed = parseInteger(customerId, "Cliente");
  if (customerIdParsed) {
    where.customerId = customerIdParsed;
  }

  if (startDate || endDate) {
    where.issueDate = {};
    if (startDate) {
      const start = new Date(startDate);
      if (!Number.isNaN(start.getTime())) {
        where.issueDate.gte = start;
      }
    }
    if (endDate) {
      const end = new Date(endDate);
      if (!Number.isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        where.issueDate.lte = end;
      }
    }
  }

  if (search) {
    const sanitized = String(search).trim();
    if (sanitized) {
      where.OR = [
        { code: { contains: sanitized, mode: "insensitive" } },
        { title: { contains: sanitized, mode: "insensitive" } },
        { customerName: { contains: sanitized, mode: "insensitive" } },
        { scope: { contains: sanitized, mode: "insensitive" } },
        { referenceNumber: { contains: sanitized, mode: "insensitive" } },
      ];
    }
  }

  return where;
}

router.get("/summary", async (req, res) => {
  try {
    const months = Number.parseInt(req.query.months, 10);
    const monthsWindow = Number.isFinite(months) && months > 0 ? Math.min(months, 24) : 12;
    const now = new Date();
    const windowStart = new Date(now.getFullYear(), now.getMonth() - (monthsWindow - 1), 1);

    const valuations = await prisma.valuation.findMany({
      where: {
        issueDate: { gte: windowStart },
      },
      select: {
        id: true,
        issueDate: true,
        totalUsd: true,
        totalLocal: true,
        customerName: true,
        customerId: true,
      },
      orderBy: { issueDate: "asc" },
    });

    const monthlyMap = new Map();
    const customerMap = new Map();

    let totalUsd = 0;
    let totalLocal = 0;

    valuations.forEach((valuation) => {
      const date = valuation.issueDate instanceof Date ? valuation.issueDate : new Date(valuation.issueDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const monthEntry = monthlyMap.get(key) || { usd: 0, local: 0 };
      const totalUsdValue = decimalToNumber(valuation.totalUsd) ?? 0;
      const totalLocalValue = decimalToNumber(valuation.totalLocal) ?? 0;

      monthEntry.usd += totalUsdValue;
      monthEntry.local += totalLocalValue;
      monthlyMap.set(key, monthEntry);

      totalUsd += totalUsdValue;
      totalLocal += totalLocalValue;

      const customerKey = valuation.customerId ?? valuation.customerName ?? "Cliente";
      const customerEntry = customerMap.get(customerKey) || {
        name: valuation.customerName ?? "Cliente",
        usd: 0,
        local: 0,
      };
      customerEntry.usd += totalUsdValue;
      customerEntry.local += totalLocalValue;
      customerMap.set(customerKey, customerEntry);
    });

    const monthly = [];
    for (let i = 0; i < monthsWindow; i += 1) {
      const cursor = new Date(now.getFullYear(), now.getMonth() - (monthsWindow - 1 - i), 1);
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      const entry = monthlyMap.get(key) || { usd: 0, local: 0 };
      monthly.push({
        key,
        label: `${cursor.toLocaleString("es-VE", { month: "short" })} ${String(cursor.getFullYear()).slice(-2)}`,
        totalUsd: Number(entry.usd.toFixed(2)),
        totalLocal: Number(entry.local.toFixed(2)),
      });
    }

    const topCustomers = Array.from(customerMap.values())
      .sort((a, b) => b.usd - a.usd)
      .slice(0, 5)
      .map((entry) => ({
        name: entry.name,
        totalUsd: Number(entry.usd.toFixed(2)),
        totalLocal: Number(entry.local.toFixed(2)),
      }));

    res.json({
      totalUsd: Number(totalUsd.toFixed(2)),
      totalLocal: Number(totalLocal.toFixed(2)),
      totalCount: valuations.length,
      monthly,
      topCustomers,
    });
  } catch (error) {
    console.error("[valuations] summary error", error);
    res.status(500).json({ error: "No se pudo generar el resumen de valuaciones" });
  }
});

router.get("/", async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page, 10) || 1;
    const pageSize = Math.min(Number.parseInt(req.query.pageSize, 10) || 10, 100);
    const skip = (page - 1) * pageSize;

    const where = buildSearchWhere(req.query);

    const [total, valuations] = await Promise.all([
      prisma.valuation.count({ where }),
      prisma.valuation.findMany({
        where,
        orderBy: { issueDate: "desc" },
        skip,
        take: pageSize,
        include: {
          customer: true,
          items: {
            orderBy: { orderIndex: "asc" },
            include: { service: true },
          },
        },
      }),
    ]);

    res.json({
      data: valuations.map(mapValuation),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(Math.ceil(total / pageSize), 1),
      },
    });
  } catch (error) {
    console.error("[valuations] list error", error);
    res.status(500).json({ error: "No se pudieron obtener las valuaciones" });
  }
});

router.get("/:id", async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Identificador inválido" });
  }

  try {
    const valuation = await prisma.valuation.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { orderBy: { orderIndex: "asc" }, include: { service: true } },
      },
    });

    if (!valuation) {
      return res.status(404).json({ error: "Valuación no encontrada" });
    }

    res.json(mapValuation(valuation));
  } catch (error) {
    console.error("[valuations] detail error", error);
    res.status(500).json({ error: "No se pudo obtener la valuación" });
  }
});

router.post("/", async (req, res) => {
  try {
    const payload = await normalizeValuationPayload(req.body);
    const code = payload.code || (await generateValuationCode());

    const created = await prisma.valuation.create({
      data: {
        code,
        title: payload.title,
        status: payload.status,
        customerId: payload.customerId,
        customerName: payload.customerName,
        customerContact: payload.customerContact,
        customerCode: payload.customerCode,
        customerAddress: payload.customerAddress,
        customerEmail: payload.customerEmail,
        customerPhone: payload.customerPhone,
        issueDate: payload.issueDate,
        dueDate: payload.dueDate,
        wellCode: payload.wellCode,
        drillCode: payload.drillCode,
        scope: payload.scope,
        workOrderNumber: payload.workOrderNumber,
        referenceNumber: payload.referenceNumber,
        paymentTerms: payload.paymentTerms,
        currency: payload.currency,
        localCurrency: payload.localCurrency,
        exchangeRate: toDecimal(payload.exchangeRate),
        subtotalUsd: toDecimal(payload.subtotalUsd),
        subtotalLocal: toDecimal(payload.subtotalLocal),
        taxRate: toDecimal(payload.taxRate),
        taxUsd: toDecimal(payload.taxUsd),
        taxLocal: toDecimal(payload.taxLocal),
        totalUsd: toDecimal(payload.totalUsd),
        totalLocal: toDecimal(payload.totalLocal),
        notes: payload.notes,
        terms: payload.terms,
        preparedBy: payload.preparedBy,
        approvedBy: payload.approvedBy,
        receivedBy: payload.receivedBy,
        receivedId: payload.receivedId,
        items: {
          create: payload.items.map((item) => ({
            serviceId: item.serviceId,
            description: item.description,
            unit: item.unit,
            quantity: toDecimal(item.quantity),
            unitPriceUsd: toDecimal(item.unitPriceUsd),
            unitPriceLocal: toDecimal(item.unitPriceLocal),
            totalUsd: toDecimal(item.totalUsd),
            totalLocal: toDecimal(item.totalLocal),
            orderIndex: item.orderIndex,
          })),
        },
      },
      include: {
        customer: true,
        items: { orderBy: { orderIndex: "asc" }, include: { service: true } },
      },
    });

    res.status(201).json(mapValuation(created));
  } catch (error) {
    console.error("[valuations] create error", error);
    const message = error instanceof Error ? error.message : "No se pudo crear la valuación";
    res.status(400).json({ error: message });
  }
});

router.put("/:id", async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Identificador inválido" });
  }

  try {
    const existing = await prisma.valuation.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Valuación no encontrada" });
    }

    const payload = await normalizeValuationPayload(req.body);
    const code = payload.code || existing.code || (await generateValuationCode());

    const updated = await prisma.valuation.update({
      where: { id },
      data: {
        code,
        title: payload.title,
        status: payload.status,
        customerId: payload.customerId,
        customerName: payload.customerName,
        customerContact: payload.customerContact,
        customerCode: payload.customerCode,
        customerAddress: payload.customerAddress,
        customerEmail: payload.customerEmail,
        customerPhone: payload.customerPhone,
        issueDate: payload.issueDate,
        dueDate: payload.dueDate,
        wellCode: payload.wellCode,
        drillCode: payload.drillCode,
        scope: payload.scope,
        workOrderNumber: payload.workOrderNumber,
        referenceNumber: payload.referenceNumber,
        paymentTerms: payload.paymentTerms,
        currency: payload.currency,
        localCurrency: payload.localCurrency,
        exchangeRate: toDecimal(payload.exchangeRate),
        subtotalUsd: toDecimal(payload.subtotalUsd),
        subtotalLocal: toDecimal(payload.subtotalLocal),
        taxRate: toDecimal(payload.taxRate),
        taxUsd: toDecimal(payload.taxUsd),
        taxLocal: toDecimal(payload.taxLocal),
        totalUsd: toDecimal(payload.totalUsd),
        totalLocal: toDecimal(payload.totalLocal),
        notes: payload.notes,
        terms: payload.terms,
        preparedBy: payload.preparedBy,
        approvedBy: payload.approvedBy,
        receivedBy: payload.receivedBy,
        receivedId: payload.receivedId,
        items: {
          deleteMany: {},
          create: payload.items.map((item) => ({
            serviceId: item.serviceId,
            description: item.description,
            unit: item.unit,
            quantity: toDecimal(item.quantity),
            unitPriceUsd: toDecimal(item.unitPriceUsd),
            unitPriceLocal: toDecimal(item.unitPriceLocal),
            totalUsd: toDecimal(item.totalUsd),
            totalLocal: toDecimal(item.totalLocal),
            orderIndex: item.orderIndex,
          })),
        },
      },
      include: {
        customer: true,
        items: { orderBy: { orderIndex: "asc" }, include: { service: true } },
      },
    });

    res.json(mapValuation(updated));
  } catch (error) {
    console.error("[valuations] update error", error);
    const message = error instanceof Error ? error.message : "No se pudo actualizar la valuación";
    res.status(400).json({ error: message });
  }
});

router.delete("/:id", async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Identificador inválido" });
  }

  try {
    await prisma.valuation.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return res.status(404).json({ error: "Valuación no encontrada" });
    }
    console.error("[valuations] delete error", error);
    res.status(500).json({ error: "No se pudo eliminar la valuación" });
  }
});

router.get("/:id/pdf", async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Identificador inválido" });
  }

  try {
    const valuation = await prisma.valuation.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { orderBy: { orderIndex: "asc" } },
      },
    });

    if (!valuation) {
      return res.status(404).json({ error: "Valuación no encontrada" });
    }

    const html = await renderValuationHtml(mapValuation(valuation));

    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf(PDF_OPTIONS);
    await browser.close();

    const filename = `valuacion-${valuation.code || valuation.id}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=\"${filename}\"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("[valuations] pdf error", error);
    res.status(500).json({ error: "No se pudo generar el PDF de la valuación" });
  }
});

export default router;
