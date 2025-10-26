import { PrismaClient } from "@prisma/client";

const DEMO_TAG = "[DEMO]";
const DEMO_PLAN_SLUGS = ["demo-basic", "demo-empresarial"];
const DEMO_VESSEL_REGISTRATIONS = ["DEMO-IMO-1001", "DEMO-IMO-1002", "DEMO-IMO-1003"];
const DEMO_CAPTAIN_CEDULAS = ["V-10000001", "V-10000002", "V-10000003"];
const DEMO_CUSTOMER_CEDULAS = ["J-40000001", "J-40000002", "J-40000003"];
const DEMO_GREENHOUSE_NAMES = ["Demo Invernadero Andino"];
const DEMO_SERVICE_CODES = ["DEMO-SRV-001", "DEMO-SRV-002", "DEMO-SRV-003", "DEMO-SRV-004"];
const DEMO_VALUATION_CODES = ["VAL-DEMO-001", "VAL-DEMO-002", "VAL-DEMO-003"];

const SAMPLE_ROLES = [
  {
    slug: "admin",
    name: "Administrador",
    description: "Acceso completo a todas las funcionalidades demo",
    permissions: ["*"]
  },
  {
    slug: "user",
    name: "Operador",
    description: "Puede consultar reportes y métricas",
    permissions: ["reports:read", "greenhouses:read"]
  }
];

const SAMPLE_PLANS = [
  {
    slug: "demo-basic",
    name: "Demo Básico",
    price: "49.00",
    period: "Mensual",
    description: "Cobertura operativa esencial para monitoreo demo",
    features: ["Hasta 3 embarcaciones", "Reportes ilimitados", "Acceso móvil"],
    icon: "starter",
    active: true
  },
  {
    slug: "demo-empresarial",
    name: "Demo Empresarial",
    price: "129.00",
    period: "Mensual",
    description: "Todo lo necesario para operaciones multi-base",
    features: ["Alertas en tiempo real", "Integración IoT", "Reportes automáticos"],
    icon: "enterprise",
    active: true
  }
];

const SAMPLE_GREENHOUSE = {
  name: "Demo Invernadero Andino",
  country: "Venezuela",
  website: "https://demo.lagoreport.com",
  phone: "+58 412-555-0101",
  cif: "J-98765432-1",
  profileImage: "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=800&q=80"
};

const SAMPLE_VESSELS = [
  {
    name: "Demo Poseidón",
    registration: "DEMO-IMO-1001",
    vesselType: "Arrastrero",
    flag: "Venezuela",
    owner: "Operaciones Demo Caribe",
    notes: `${DEMO_TAG} Embarcación de prueba para escenarios costeros`
  },
  {
    name: "Demo Atlántida",
    registration: "DEMO-IMO-1002",
    vesselType: "Cabotaje",
    flag: "Colombia",
    owner: "Flota Integrada Demo",
    notes: `${DEMO_TAG} Nave multipropósito para rutas cortas`
  },
  {
    name: "Demo Mar Caribe",
    registration: "DEMO-IMO-1003",
    vesselType: "Investigación",
    flag: "Panamá",
    owner: "Centro Tecnológico Demo",
    notes: `${DEMO_TAG} Embarcación equipada con sensores ambientales`
  }
];

const SAMPLE_CAPTAINS = [
  {
    name: "Juan Pérez",
    cedula: "V-10000001",
    phone: "+58 424-1234567",
    photoUrl: null,
    signatureUrl: null
  },
  {
    name: "Mariana Rodríguez",
    cedula: "V-10000002",
    phone: "+57 300-5551212",
    photoUrl: null,
    signatureUrl: null
  },
  {
    name: "Edgar Castillo",
    cedula: "V-10000003",
    phone: "+507 6000-7788",
    photoUrl: null,
    signatureUrl: null
  }
];

const SAMPLE_CUSTOMERS = [
  {
    name: "PetroMar Demo",
    cedula: "J-40000001",
    phone: "+58 261-5553344",
    photoUrl: null,
    signatureUrl: null
  },
  {
    name: "Atlantic Services Demo",
    cedula: "J-40000002",
    phone: "+57 1 600-7788",
    photoUrl: null,
    signatureUrl: null
  },
  {
    name: "Pacífico Oil Demo",
    cedula: "J-40000003",
    phone: "+507 834-6677",
    photoUrl: null,
    signatureUrl: null
  }
];

const SAMPLE_SERVICES = [
  {
    code: "DEMO-SRV-001",
    name: "Supervisión integral de operaciones",
    description: `${DEMO_TAG} Cobertura diaria de supervisión y apoyo operacional en terminales activos`,
    unit: "Jornada",
    unitPriceUsd: "520.00",
    unitPriceLocal: null,
    localCurrency: "VES",
    isActive: true
  },
  {
    code: "DEMO-SRV-002",
    name: "Inspección de seguridad de casco",
    description: `${DEMO_TAG} Evaluación estructural, registro fotográfico y emisión de informe técnico`,
    unit: "Jornada",
    unitPriceUsd: "380.00",
    unitPriceLocal: null,
    localCurrency: "VES",
    isActive: true
  },
  {
    code: "DEMO-SRV-003",
    name: "Asistencia logística de cabotaje",
    description: `${DEMO_TAG} Coordinación de maniobras, control de inventario y soporte a tripulación`,
    unit: "Día",
    unitPriceUsd: "310.00",
    unitPriceLocal: null,
    localCurrency: "VES",
    isActive: true
  },
  {
    code: "DEMO-SRV-004",
    name: "Calibración de sensores oceanográficos",
    description: `${DEMO_TAG} Ajuste, pruebas funcionales y certificación de equipos de medición marina`,
    unit: "Operación",
    unitPriceUsd: "440.00",
    unitPriceLocal: null,
    localCurrency: "VES",
    isActive: true
  }
];

const REPORT_SCENARIOS = [
  {
    vesselRegistration: "DEMO-IMO-1001",
    captainCedula: "V-10000001",
    customerCedula: "J-40000001",
    latitude: 10.6412,
    longitude: -71.6387,
    summary: "Ruta de inspección de plataformas",
    status: "APPROVED",
    startMinutes: 7 * 60 + 30,
    activities: [
      { description: "Reunión de coordinación con supervisores", durationMinutes: 45, breakMinutes: 15 },
      { description: "Traslado a plataforma LGO-12", durationMinutes: 195, breakMinutes: 15 },
      { description: "Inspección visual y registro fotográfico", durationMinutes: 220 }
    ]
  },
  {
    vesselRegistration: "DEMO-IMO-1002",
    captainCedula: "V-10000002",
    customerCedula: "J-40000002",
    latitude: 11.0121,
    longitude: -71.2104,
    summary: "Supervisión de maniobras de cabotaje",
    status: "APPROVED",
    startMinutes: 6 * 60 + 45,
    activities: [
      { description: "Verificación de cargas y permisos", durationMinutes: 75, breakMinutes: 15 },
      { description: "Seguimiento de navegación en ruta costera", durationMinutes: 255, breakMinutes: 60 },
      { description: "Reporte de cierre y entrega de documentación", durationMinutes: 100 }
    ]
  },
  {
    vesselRegistration: "DEMO-IMO-1001",
    captainCedula: "V-10000001",
    customerCedula: "J-40000003",
    latitude: 10.4822,
    longitude: -71.8041,
    summary: "Monitoreo de faena de extracción",
    status: "APPROVED",
    startMinutes: 8 * 60 + 20,
    activities: [
      { description: "Inicio de turno y calibración de equipos", durationMinutes: 50, breakMinutes: 10 },
      { description: "Seguimiento de extracción en pozo norte", durationMinutes: 205, breakMinutes: 45 },
      { description: "Consolidación de datos y envío de informes", durationMinutes: 85 }
    ]
  },
  {
    vesselRegistration: "DEMO-IMO-1003",
    captainCedula: "V-10000003",
    customerCedula: "J-40000001",
    latitude: 11.224,
    longitude: -70.986,
    summary: "Campaña de investigación oceanográfica",
    status: "APPROVED",
    startMinutes: 7 * 60 + 10,
    activities: [
      { description: "Preparación de sensores y muestreo", durationMinutes: 110, breakMinutes: 10 },
      { description: "Recolección de datos batimétricos", durationMinutes: 190, breakMinutes: 10 },
      { description: "Procesamiento preliminar de datos", durationMinutes: 70 }
    ]
  },
  {
    vesselRegistration: "DEMO-IMO-1002",
    captainCedula: "V-10000002",
    customerCedula: "J-40000002",
    latitude: 10.9123,
    longitude: -70.7351,
    summary: "Auditoría de seguridad portuaria",
    status: "APPROVED",
    startMinutes: 8 * 60,
    activities: [
      { description: "Lista de verificación de seguridad", durationMinutes: 135, breakMinutes: 15 },
      { description: "Pruebas de comunicación y respuesta", durationMinutes: 150, breakMinutes: 120 },
      { description: "Revisión de bitácoras y cierre", durationMinutes: 140 }
    ]
  },
  {
    vesselRegistration: "DEMO-IMO-1003",
    captainCedula: "V-10000003",
    customerCedula: "J-40000003",
    latitude: 11.5032,
    longitude: -71.4012,
    summary: "Evaluación trimestral de equipos científicos",
    status: "APPROVED",
    startMinutes: 9 * 60 + 10,
    activities: [
      { description: "Inspección de racks de sensores", durationMinutes: 110, breakMinutes: 15 },
      { description: "Pruebas de calibración en laboratorio", durationMinutes: 195, breakMinutes: 30 },
      { description: "Informe técnico y recomendaciones", durationMinutes: 165 }
    ]
  }
];

const SAMPLE_VALUATIONS = [
  {
    code: "VAL-DEMO-001",
    title: "Supervisión integral en terminal Cabimas",
    status: "APPROVED",
    customerCedula: "J-40000001",
    issueDaysAgo: 26,
    dueInDays: 20,
    currency: "USD",
    localCurrency: "VES",
    exchangeRate: 36.5,
    taxRate: 16,
    scope: "Cobertura de operaciones y control de maniobras en terminal LGO-12 durante rotación de flota.",
    workOrderNumber: "WO-DEM-4587",
    referenceNumber: "REF-2024-OPS-09",
    paymentTerms: "Pago neto a 30 días",
    preparedBy: "Ing. Beatriz Salazar",
    approvedBy: "Lic. Jorge Ramírez",
    notes: "Incluye soporte en sitio, reporte diario y enlace permanente con sala situacional.",
    terms: "Tarifas válidas por 30 días. Servicios adicionales se cotizarán por separado.",
    customerContact: "Carlos Peña",
    customerEmail: "cpena@petromar.demo",
    customerPhone: "+58 261-5553344",
    customerAddress: "Av. La Marina, Cabimas, Zulia",
    wellCode: "LGO-12",
    drillCode: "CBM-07",
    items: [
      { serviceCode: "DEMO-SRV-001", quantity: 5 },
      { serviceCode: "DEMO-SRV-002", quantity: 2 },
      { serviceCode: "DEMO-SRV-003", quantity: 3, unitPriceUsd: 325 }
    ]
  },
  {
    code: "VAL-DEMO-002",
    title: "Plan logístico trimestral Caribe oriental",
    status: "SENT",
    customerCedula: "J-40000002",
    issueDaysAgo: 12,
    dueInDays: 18,
    currency: "USD",
    localCurrency: "VES",
    exchangeRate: 36.8,
    taxRate: 16,
    scope: "Programa escalonado de apoyo a flota de cabotaje con cobertura portuaria y reportes de desempeño.",
    workOrderNumber: "WO-DEM-5621",
    referenceNumber: "REF-2024-LOG-04",
    paymentTerms: "Anticipo 50% y saldo contra entrega",
    preparedBy: "Tec. Luis Contreras",
    approvedBy: "Gerente Operaciones Demo",
    notes: "Cobertura ajustable por ventanas operativas y personalización de recursos.",
    terms: "Incluye desplazamientos en zona autorizada. Gastos extraordinarios se facturan aparte.",
    customerContact: "María Gómez",
    customerEmail: "mgomez@atlantic.demo",
    customerPhone: "+57 1 600-7788",
    customerAddress: "Zona Franca Mamonal, Cartagena",
    items: [
      { serviceCode: "DEMO-SRV-003", quantity: 6 },
      { serviceCode: "DEMO-SRV-001", quantity: 3 },
      { description: "Coordinación de permisos portuarios", unit: "Paquete", quantity: 1, unitPriceUsd: 420 },
      { serviceCode: "DEMO-SRV-004", quantity: 2, unitPriceUsd: 455 }
    ]
  },
  {
    code: "VAL-DEMO-003",
    title: "Calibración de equipos científicos Q4",
    status: "DRAFT",
    customerCedula: "J-40000003",
    issueDaysAgo: 5,
    dueInDays: 20,
    currency: "USD",
    localCurrency: "VES",
    exchangeRate: 37.1,
    taxRate: 0,
    scope: "Ajuste de sensores oceanográficos y verificación de registros para campaña trimestral.",
    workOrderNumber: "WO-DEM-6102",
    referenceNumber: "REF-2024-TEC-11",
    paymentTerms: "Pago a 15 días",
    preparedBy: "Ing. Daniela Ortega",
    approvedBy: null,
    notes: "Pendiente confirmación de inventario adicional y ventana climática.",
    terms: "La disponibilidad de muelles debe coordinarse con 72 horas de antelación.",
    customerContact: "José Medina",
    customerEmail: "jmedina@pacifico.demo",
    customerPhone: "+507 834-6677",
    customerAddress: "Calzada de Amador, Ciudad de Panamá",
    items: [
      { serviceCode: "DEMO-SRV-004", quantity: 4 },
      { description: "Soporte técnico remoto", unit: "Hora", quantity: 12, unitPriceUsd: 95 }
    ]
  }
];

function toDateTime(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}:00.000Z`);
}

function toDateOnly(dateStr) {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function minutesBetween(start, end) {
  return Math.max(Math.round((end.getTime() - start.getTime()) / 60000), 0);
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function minutesToTime(totalMinutes) {
  const minutesInDay = 24 * 60;
  const normalized = ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function daysFromToday(offset = 0) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
}

function toRoundedNumber(value, fractionDigits = 2) {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const factor = 10 ** fractionDigits;
  return Math.round(numeric * factor) / factor;
}

function addMoney(base, increment) {
  const baseValue = Number(base);
  const incrementValue = Number(increment);
  if (!Number.isFinite(baseValue) || !Number.isFinite(incrementValue)) {
    throw new Error("Valores monetarios inválidos en el cálculo de demo");
  }
  return Math.round((baseValue + incrementValue) * 100) / 100;
}

function buildActivityTimeline(activityConfigs, startMinutes) {
  const timeline = [];
  let cursor = startMinutes;
  activityConfigs.forEach((activity, index) => {
    const start = cursor;
    const end = cursor + activity.durationMinutes;
    timeline.push({
      description: activity.description,
      start: minutesToTime(start),
      end: minutesToTime(end)
    });
    cursor = end;
    if (activity.breakMinutes && index < activityConfigs.length - 1) {
      cursor += activity.breakMinutes;
    }
  });
  return { timeline, endMinutes: cursor };
}

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("es-VE", { month: "long" });

function generateRecentReportConfigs(months = 6) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(today);
  startDate.setMonth(startDate.getMonth() - (months - 1));
  startDate.setDate(1);

  const configs = [];
  let dayIndex = 0;

  for (let cursor = new Date(startDate); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
    const currentDate = new Date(cursor);
    const scenario = REPORT_SCENARIOS[dayIndex % REPORT_SCENARIOS.length];
    const startVariation = (dayIndex % 4) * 10;
    const startMinutes = scenario.startMinutes + startVariation;
    const { timeline, endMinutes } = buildActivityTimeline(scenario.activities, startMinutes);

    const latOffset = ((dayIndex % 5) - 2) * 0.015;
    const lonOffset = ((dayIndex % 5) - 2) * 0.018;
    const summaryLabel = `${scenario.summary} - ${MONTH_LABEL_FORMATTER.format(currentDate)} ${currentDate.getFullYear()}`;

    configs.push({
      vesselRegistration: scenario.vesselRegistration,
      captainCedula: scenario.captainCedula,
      customerCedula: scenario.customerCedula,
      date: formatDateKey(currentDate),
      startTime: minutesToTime(startMinutes),
      endTime: minutesToTime(endMinutes),
      latitude: Number((scenario.latitude + latOffset).toFixed(4)),
      longitude: Number((scenario.longitude + lonOffset).toFixed(4)),
      summary: summaryLabel,
      status: scenario.status ?? "APPROVED",
      activities: timeline
    });

    dayIndex += 1;
  }

  return configs;
}

function buildSensorSeries(count) {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() - count + 1);

  const entries = [];
  for (let index = 0; index < count; index += 1) {
    const timestamp = new Date(start.getTime() + index * 60 * 60 * 1000);
    const phase = index / Math.max(count - 1, 1);
    const temperature = 24 + Math.sin(phase * Math.PI * 2) * 4;
    const humidity = 58 + Math.cos(phase * Math.PI * 2) * 8;
    const brightness = 450 + Math.max(Math.sin((phase - 0.2) * Math.PI * 2), 0) * 320;
    const soilHumidity = 34 + Math.cos((phase + 0.15) * Math.PI * 2) * 4;
    const co2 = 420 + Math.sin((phase + 0.3) * Math.PI * 2) * 60;
    const ph = 6.3 + Math.sin((phase + 0.5) * Math.PI * 2) * 0.2;
    const luminosity = 62 + Math.max(Math.sin((phase + 0.1) * Math.PI * 2), 0) * 20;
    const moi = 30 + Math.cos((phase + 0.4) * Math.PI * 2) * 2.5;

    entries.push({
      timestamp,
      temperature: Number(temperature.toFixed(2)),
      humidity: Number(humidity.toFixed(2)),
      brightness: Number(brightness.toFixed(2)),
      soilHumidity: Number(soilHumidity.toFixed(2)),
      co2: Number(co2.toFixed(2)),
      ph: Number(ph.toFixed(2)),
      luminosity: Number(luminosity.toFixed(2)),
      moi: Number(moi.toFixed(2))
    });
  }

  return entries;
}

async function ensureRoles(tx) {
  for (const role of SAMPLE_ROLES) {
    await tx.role.upsert({
      where: { slug: role.slug },
      update: {
        name: role.name,
        description: role.description,
        permissions: role.permissions
      },
      create: role
    });
  }
}

async function ensurePlans(tx) {
  const created = [];
  for (const plan of SAMPLE_PLANS) {
    const result = await tx.plan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        price: plan.price,
        period: plan.period,
        description: plan.description,
        features: plan.features,
        icon: plan.icon,
        active: plan.active
      },
      create: plan
    });
    created.push(result);
  }
  return created;
}

async function createGreenhouseWithSensors(tx) {
  const greenhouse = await tx.greenhouse.create({
    data: SAMPLE_GREENHOUSE
  });

  const sensorSeries = buildSensorSeries(24);

  await tx.temperature.createMany({
    data: sensorSeries.map((entry) => ({
      greenhouseId: greenhouse.id,
      value: entry.temperature,
      timestamp: entry.timestamp
    }))
  });
  await tx.humidity.createMany({
    data: sensorSeries.map((entry) => ({
      greenhouseId: greenhouse.id,
      value: entry.humidity,
      timestamp: entry.timestamp
    }))
  });
  await tx.brightness.createMany({
    data: sensorSeries.map((entry) => ({
      greenhouseId: greenhouse.id,
      value: entry.brightness,
      timestamp: entry.timestamp
    }))
  });
  await tx.soilHumidity.createMany({
    data: sensorSeries.map((entry) => ({
      greenhouseId: greenhouse.id,
      value: entry.soilHumidity,
      timestamp: entry.timestamp
    }))
  });
  await tx.co2.createMany({
    data: sensorSeries.map((entry) => ({
      greenhouseId: greenhouse.id,
      value: entry.co2,
      timestamp: entry.timestamp
    }))
  });
  await tx.ph.createMany({
    data: sensorSeries.map((entry) => ({
      greenhouseId: greenhouse.id,
      value: entry.ph,
      timestamp: entry.timestamp
    }))
  });
  await tx.luminosity.createMany({
    data: sensorSeries.map((entry) => ({
      greenhouseId: greenhouse.id,
      value: entry.luminosity,
      timestamp: entry.timestamp
    }))
  });
  await tx.moi.createMany({
    data: sensorSeries.map((entry) => ({
      greenhouseId: greenhouse.id,
      value: entry.moi,
      timestamp: entry.timestamp
    }))
  });

  await tx.fan1.createMany({
    data: [0.2, 0.6, 0.1, 0.7].map((value) => ({
      greenhouseId: greenhouse.id,
      value
    }))
  });
  await tx.lamp1.createMany({
    data: [0.1, 0.8, 0.3].map((value) => ({
      greenhouseId: greenhouse.id,
      value
    }))
  });
  await tx.pump1.createMany({
    data: [0.5, 0.4, 0.9].map((value) => ({
      greenhouseId: greenhouse.id,
      value
    }))
  });
  await tx.heater1.createMany({
    data: [0.0, 0.25, 0.45].map((value) => ({
      greenhouseId: greenhouse.id,
      value
    }))
  });
  await tx.rs_med.createMany({
    data: [2.1, 2.4, 2.6].map((value) => ({
      greenhouseId: greenhouse.id,
      value
    }))
  });
  await tx.volts.createMany({
    data: [110.5, 109.9, 111.2].map((value) => ({
      greenhouseId: greenhouse.id,
      value
    }))
  });

  return greenhouse;
}

async function createServices(tx) {
  const services = [];
  for (const service of SAMPLE_SERVICES) {
    const created = await tx.service.upsert({
      where: { code: service.code },
      update: {
        name: service.name,
        description: service.description,
        unit: service.unit,
        unitPriceUsd: service.unitPriceUsd,
        unitPriceLocal: service.unitPriceLocal,
        localCurrency: service.localCurrency,
        isActive: service.isActive
      },
      create: service
    });
    services.push(created);
  }
  return services;
}

async function createCatalogs(tx) {
  const vessels = [];
  for (const vessel of SAMPLE_VESSELS) {
    const created = await tx.vessel.upsert({
      where: { registration: vessel.registration },
      update: {
        name: vessel.name,
        vesselType: vessel.vesselType,
        flag: vessel.flag,
        owner: vessel.owner,
        notes: vessel.notes
      },
      create: vessel
    });
    vessels.push(created);
  }

  const captains = [];
  for (const captain of SAMPLE_CAPTAINS) {
    const created = await tx.captain.upsert({
      where: { cedula: captain.cedula },
      update: {
        name: captain.name,
        phone: captain.phone,
        photoUrl: captain.photoUrl,
        signatureUrl: captain.signatureUrl
      },
      create: captain
    });
    captains.push(created);
  }

  const customers = [];
  for (const customer of SAMPLE_CUSTOMERS) {
    const created = await tx.customer.upsert({
      where: { cedula: customer.cedula },
      update: {
        name: customer.name,
        phone: customer.phone,
        photoUrl: customer.photoUrl,
        signatureUrl: customer.signatureUrl
      },
      create: customer
    });
    customers.push(created);
  }

  return { vessels, captains, customers };
}

async function createValuations(tx, catalogs, services) {
  const valuations = [];
  const serviceMap = new Map(services.map((service) => [service.code, service]));

  for (const config of SAMPLE_VALUATIONS) {
    const customer = catalogs.customers.find((item) => item.cedula === config.customerCedula);
    if (!customer) {
      continue;
    }

    const issueOffset = -Math.abs(config.issueDaysAgo ?? 0);
    const issueDate = daysFromToday(issueOffset);
    const dueDate = typeof config.dueInDays === "number" ? daysFromToday(issueOffset + config.dueInDays) : null;

    const exchangeRate = config.exchangeRate ?? null;
    const hasExchange = exchangeRate !== null && Number.isFinite(Number(exchangeRate));
    const taxRateRaw = config.taxRate ?? null;
    const hasTax = taxRateRaw !== null && Number.isFinite(Number(taxRateRaw));

    const itemInputs = Array.isArray(config.items) ? config.items : [];
    if (itemInputs.length === 0) {
      continue;
    }

    let subtotalUsd = 0;
    let subtotalLocal = hasExchange ? 0 : null;

    const preparedItems = itemInputs.map((item, index) => {
      const service = item.serviceCode ? serviceMap.get(item.serviceCode) : null;
      if (item.serviceCode && !service) {
        throw new Error(`Servicio demo no encontrado para valuación ${config.code}: ${item.serviceCode}`);
      }

      const description = item.description ?? service?.name ?? null;
      const unit = item.unit ?? service?.unit ?? null;
      if (!description || !unit) {
        throw new Error(`Descripción o unidad faltante en valuación demo ${config.code}`);
      }

      const quantityValue = toRoundedNumber(item.quantity ?? 1, 2);
      if (quantityValue === null || quantityValue <= 0) {
        throw new Error(`Cantidad inválida en valuación demo ${config.code}`);
      }

      const unitPriceSource = item.unitPriceUsd ?? service?.unitPriceUsd ?? 0;
      const unitPriceUsd = toRoundedNumber(unitPriceSource, 2) ?? 0;
      const totalUsd = toRoundedNumber(quantityValue * unitPriceUsd, 2) ?? 0;

      subtotalUsd = addMoney(subtotalUsd, totalUsd);

      let unitPriceLocal = null;
      let totalLocal = null;
      if (hasExchange) {
        unitPriceLocal = toRoundedNumber(unitPriceUsd * exchangeRate, 2);
        totalLocal = toRoundedNumber(quantityValue * unitPriceUsd * exchangeRate, 2);
        subtotalLocal = addMoney(subtotalLocal ?? 0, totalLocal ?? 0);
      }

      return {
        orderIndex: index,
        serviceId: service ? service.id : null,
        description,
        unit,
        quantity: quantityValue,
        unitPriceUsd,
        totalUsd,
        unitPriceLocal,
        totalLocal
      };
    });

    const taxRate = hasTax ? toRoundedNumber(taxRateRaw, 2) : null;
    const taxUsd = hasTax ? toRoundedNumber(subtotalUsd * (Number(taxRate) ?? 0) / 100, 2) : null;
    const totalUsd = toRoundedNumber(subtotalUsd + (taxUsd ?? 0), 2) ?? subtotalUsd;

    let taxLocal = null;
    let totalLocal = null;
    if (hasExchange) {
      if (!Number.isFinite(Number(exchangeRate))) {
        throw new Error(`Tasa de cambio inválida para valuación demo ${config.code}`);
      }
      if (subtotalLocal === null) {
        subtotalLocal = 0;
      }
      taxLocal = hasTax ? toRoundedNumber(subtotalLocal * (Number(taxRate) ?? 0) / 100, 2) : null;
      totalLocal = hasTax ? toRoundedNumber(subtotalLocal + (taxLocal ?? 0), 2) : toRoundedNumber(subtotalLocal, 2);
      subtotalLocal = toRoundedNumber(subtotalLocal, 2);
    }

    const created = await tx.valuation.create({
      data: {
        code: config.code,
        title: config.title,
        status: config.status ?? "DRAFT",
        customerId: customer.id,
        customerName: customer.name,
        customerContact: config.customerContact ?? null,
        customerCode: config.customerCode ?? customer.cedula,
        customerAddress: config.customerAddress ?? null,
        customerEmail: config.customerEmail ?? null,
        customerPhone: config.customerPhone ?? customer.phone ?? null,
        issueDate,
        dueDate,
        wellCode: config.wellCode ?? null,
        drillCode: config.drillCode ?? null,
        scope: config.scope ?? null,
        workOrderNumber: config.workOrderNumber ?? null,
        referenceNumber: config.referenceNumber ?? null,
        paymentTerms: config.paymentTerms ?? null,
        currency: config.currency ?? "USD",
        localCurrency: config.localCurrency ?? (hasExchange ? "VES" : null),
        exchangeRate: hasExchange ? exchangeRate : null,
        subtotalUsd: toRoundedNumber(subtotalUsd, 2) ?? 0,
        subtotalLocal,
        taxRate,
        taxUsd,
        taxLocal,
        totalUsd,
        totalLocal,
        notes: config.notes ? `${DEMO_TAG} ${config.notes}` : DEMO_TAG,
        terms: config.terms ?? null,
        preparedBy: config.preparedBy ?? "Equipo LagoReport Demo",
        approvedBy: config.approvedBy ?? null,
        receivedBy: config.receivedBy ?? null,
        receivedId: config.receivedId ?? null,
        items: {
          create: preparedItems.map((item) => ({
            orderIndex: item.orderIndex,
            serviceId: item.serviceId,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            unitPriceUsd: item.unitPriceUsd,
            unitPriceLocal: item.unitPriceLocal,
            totalUsd: item.totalUsd,
            totalLocal: item.totalLocal
          }))
        }
      }
    });

    valuations.push(created);
  }

  return valuations;
}

async function createReports(tx, catalogs) {
  const reports = [];
  const reportConfigs = generateRecentReportConfigs(6);

  for (const reportConfig of reportConfigs) {
    const vessel = catalogs.vessels.find((item) => item.registration === reportConfig.vesselRegistration);
    const captain = catalogs.captains.find((item) => item.cedula === reportConfig.captainCedula);
    const customer = catalogs.customers.find((item) => item.cedula === reportConfig.customerCedula);
    if (!vessel || !captain || !customer) {
      continue;
    }

    const serviceDate = toDateOnly(reportConfig.date);
    const serviceStart = toDateTime(reportConfig.date, reportConfig.startTime);
    const serviceEnd = toDateTime(reportConfig.date, reportConfig.endTime);
    const totalMinutes = minutesBetween(serviceStart, serviceEnd);

    const created = await tx.report.create({
      data: {
        vesselId: vessel.id,
        vesselName: vessel.name,
        captainId: captain.id,
        captainName: captain.name,
        clientName: customer.name,
        customerId: customer.id,
        patronName: "Carlos Herrera",
        motoristaName: "Luis Mendoza",
        cookName: "Ana Díaz",
        sailorName: "Pedro Silva",
        companySupervisorName: "Supervisor Demo",
        clientSupervisorName: "Coordinador Cliente Demo",
        latitude: reportConfig.latitude,
        longitude: reportConfig.longitude,
        serviceDate,
        serviceStart,
        serviceEnd,
        totalServiceMinutes: totalMinutes,
        status: reportConfig.status,
        supportImageUrl: null,
        notes: `${DEMO_TAG} ${reportConfig.summary}`,
        activities: {
          create: reportConfig.activities.map((activity) => {
            const startedAt = toDateTime(reportConfig.date, activity.start);
            let endedAt = toDateTime(reportConfig.date, activity.end);
            if (endedAt <= startedAt) {
              endedAt = new Date(startedAt.getTime() + 60 * 60 * 1000);
            }
            return {
              description: `${DEMO_TAG} ${activity.description}`,
              startedAt,
              endedAt,
              imageUrl: null
            };
          })
        }
      }
    });

    reports.push(created);
  }

  return reports;
}

async function removeExistingSampleData(tx) {
  await tx.valuation.deleteMany({
    where: {
      code: {
        in: DEMO_VALUATION_CODES
      }
    }
  });

  await tx.service.deleteMany({
    where: {
      code: {
        in: DEMO_SERVICE_CODES
      }
    }
  });

  await tx.report.deleteMany({
    where: {
      notes: {
        contains: DEMO_TAG
      }
    }
  });

  await tx.reportActivity.deleteMany({
    where: {
      description: {
        contains: DEMO_TAG
      }
    }
  });

  await tx.vessel.deleteMany({
    where: {
      registration: {
        in: DEMO_VESSEL_REGISTRATIONS
      }
    }
  });

  await tx.captain.deleteMany({
    where: {
      cedula: {
        in: DEMO_CAPTAIN_CEDULAS
      }
    }
  });

  await tx.customer.deleteMany({
    where: {
      cedula: {
        in: DEMO_CUSTOMER_CEDULAS
      }
    }
  });

  const greenhouseIds = await tx.greenhouse.findMany({
    where: {
      name: {
        in: DEMO_GREENHOUSE_NAMES
      }
    },
    select: { id: true }
  });

  if (greenhouseIds.length > 0) {
    const ids = greenhouseIds.map((item) => item.id);
    await tx.temperature.deleteMany({ where: { greenhouseId: { in: ids } } });
    await tx.humidity.deleteMany({ where: { greenhouseId: { in: ids } } });
    await tx.brightness.deleteMany({ where: { greenhouseId: { in: ids } } });
    await tx.soilHumidity.deleteMany({ where: { greenhouseId: { in: ids } } });
    await tx.co2.deleteMany({ where: { greenhouseId: { in: ids } } });
    await tx.ph.deleteMany({ where: { greenhouseId: { in: ids } } });
    await tx.luminosity.deleteMany({ where: { greenhouseId: { in: ids } } });
    await tx.moi.deleteMany({ where: { greenhouseId: { in: ids } } });
    await tx.fan1.deleteMany({ where: { greenhouseId: { in: ids } } });
    await tx.lamp1.deleteMany({ where: { greenhouseId: { in: ids } } });
    await tx.pump1.deleteMany({ where: { greenhouseId: { in: ids } } });
    await tx.heater1.deleteMany({ where: { greenhouseId: { in: ids } } });
    await tx.rs_med.deleteMany({ where: { greenhouseId: { in: ids } } });
    await tx.volts.deleteMany({ where: { greenhouseId: { in: ids } } });
    await tx.greenhouse.deleteMany({ where: { id: { in: ids } } });
  }

  await tx.plan.deleteMany({
    where: {
      slug: {
        in: DEMO_PLAN_SLUGS
      }
    }
  });
}

export async function clearSampleData(prisma = new PrismaClient()) {
  const result = await prisma.$transaction(async (tx) => {
    await removeExistingSampleData(tx);
    return { cleared: true };
  });
  return result;
}

export async function seedSampleData(prisma = new PrismaClient()) {
  await prisma.$transaction(async (tx) => {
    await removeExistingSampleData(tx);
  });

  const summary = await prisma.$transaction(async (tx) => {
    await ensureRoles(tx);
    await ensurePlans(tx);
    const greenhouse = await createGreenhouseWithSensors(tx);
    const services = await createServices(tx);
    const catalogs = await createCatalogs(tx);
    const valuations = await createValuations(tx, catalogs, services);
    const reports = await createReports(tx, catalogs);
    return {
      greenhouse,
      services,
      catalogs,
      valuations,
      reports
    };
  });

  return {
    greenhouseCount: summary.greenhouse ? 1 : 0,
    serviceCount: summary.services.length,
    vesselCount: summary.catalogs.vessels.length,
    captainCount: summary.catalogs.captains.length,
    customerCount: summary.catalogs.customers.length,
    valuationCount: summary.valuations.length,
    reportCount: summary.reports.length
  };
}

export async function getSampleDataStatus(prisma = new PrismaClient()) {
  const [reportCount, greenhouseCount] = await Promise.all([
    prisma.report.count({
      where: {
        notes: {
          contains: DEMO_TAG
        }
      }
    }),
    prisma.greenhouse.count({
      where: {
        name: {
          in: DEMO_GREENHOUSE_NAMES
        }
      }
    })
  ]);

  return {
    hasSampleData: reportCount > 0 || greenhouseCount > 0,
    counts: {
      reports: reportCount,
      greenhouses: greenhouseCount
    }
  };
}
