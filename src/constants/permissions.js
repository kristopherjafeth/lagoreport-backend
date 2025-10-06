export const PERMISSION_GROUPS = [
  {
    module: "dashboard",
    label: "Panel de control",
    description: "Acceso al panel principal con métricas y resúmenes generales.",
    permissions: [{ value: "dashboard.view", label: "Ver panel de control" }],
  },
  {
    module: "reports",
    label: "Reportes",
    description: "Gestión completa de reportes y sus acciones asociadas.",
    permissions: [
      { value: "reports.view", label: "Ver reportes" },
      { value: "reports.create", label: "Crear reportes" },
      { value: "reports.update", label: "Editar reportes" },
      { value: "reports.delete", label: "Eliminar reportes" },
      { value: "reports.export", label: "Exportar reportes" },
    ],
  },
  {
    module: "customers",
    label: "Clientes",
    description: "Administración del catálogo de clientes y su información.",
    permissions: [
      { value: "customers.view", label: "Ver clientes" },
      { value: "customers.create", label: "Crear clientes" },
      { value: "customers.update", label: "Editar clientes" },
      { value: "customers.delete", label: "Eliminar clientes" },
    ],
  },
  {
    module: "captains",
    label: "Capitanes",
    description: "Control de los capitanes y su documentación.",
    permissions: [
      { value: "captains.view", label: "Ver capitanes" },
      { value: "captains.create", label: "Registrar capitanes" },
      { value: "captains.update", label: "Editar capitanes" },
      { value: "captains.delete", label: "Eliminar capitanes" },
    ],
  },
  {
    module: "vessels",
    label: "Embarcaciones",
    description: "Inventario y detalle de las embarcaciones operativas.",
    permissions: [
      { value: "vessels.view", label: "Ver embarcaciones" },
      { value: "vessels.create", label: "Registrar embarcaciones" },
      { value: "vessels.update", label: "Editar embarcaciones" },
      { value: "vessels.delete", label: "Eliminar embarcaciones" },
    ],
  },
  {
    module: "greenhouses",
    label: "Invernaderos",
    description: "Gestión de los invernaderos y sus variables ambientales.",
    permissions: [
      { value: "greenhouses.view", label: "Ver invernaderos" },
      { value: "greenhouses.create", label: "Registrar invernaderos" },
      { value: "greenhouses.update", label: "Editar invernaderos" },
      { value: "greenhouses.delete", label: "Eliminar invernaderos" },
    ],
  },
  {
    module: "plans",
    label: "Planes de suscripción",
    description: "Configuración y mantenimiento de planes de pago.",
    permissions: [
      { value: "plans.view", label: "Ver planes" },
      { value: "plans.create", label: "Crear planes" },
      { value: "plans.update", label: "Editar planes" },
      { value: "plans.delete", label: "Eliminar planes" },
    ],
  },
  {
    module: "catalogs",
    label: "Catálogos",
    description: "Catálogos maestros utilizados en la plataforma.",
    permissions: [
      { value: "catalogs.view", label: "Ver catálogos" },
      { value: "catalogs.create", label: "Crear catálogos" },
      { value: "catalogs.update", label: "Editar catálogos" },
      { value: "catalogs.delete", label: "Eliminar catálogos" },
    ],
  },
  {
    module: "users",
    label: "Usuarios",
    description: "Gestión de cuentas de usuario y sus atributos.",
    permissions: [
      { value: "users.view", label: "Ver usuarios" },
      { value: "users.create", label: "Crear usuarios" },
      { value: "users.update", label: "Editar usuarios" },
      { value: "users.delete", label: "Eliminar usuarios" },
      { value: "users.assign", label: "Asignar roles a usuarios" },
    ],
  },
  {
    module: "roles",
    label: "Roles y permisos",
    description: "Configuración de roles, plantillas y permisos del sistema.",
    permissions: [
      { value: "roles.view", label: "Ver roles" },
      { value: "roles.create", label: "Crear roles" },
      { value: "roles.update", label: "Editar roles" },
      { value: "roles.delete", label: "Eliminar roles" },
      { value: "roles.manage-permissions", label: "Gestionar permisos" },
    ],
  },
  {
    module: "commands",
    label: "Automatización y comandos",
    description: "Ejecución de comandos y automatizaciones sobre el sistema.",
    permissions: [
      { value: "commands.send", label: "Enviar comandos" },
      { value: "commands.view", label: "Ver historial de comandos" },
    ],
  },
];

export const PERMISSION_VALUE_SET = new Set(
  PERMISSION_GROUPS.flatMap((group) => group.permissions.map((permission) => permission.value)),
);

export const ALL_PERMISSION_VALUES = Array.from(PERMISSION_VALUE_SET.values());

export const DEFAULT_ROLE_PERMISSIONS = {
  admin: [...ALL_PERMISSION_VALUES],
  moderator: [
    "dashboard.view",
    "reports.view",
    "reports.create",
    "reports.update",
    "reports.export",
    "customers.view",
    "customers.update",
    "captains.view",
    "captains.update",
    "vessels.view",
    "vessels.update",
    "greenhouses.view",
    "greenhouses.update",
    "plans.view",
    "catalogs.view",
    "users.view",
    "users.update",
    "roles.view",
    "commands.send",
    "commands.view",
  ],
  user: [
    "dashboard.view",
    "reports.view",
    "customers.view",
    "captains.view",
    "vessels.view",
    "greenhouses.view",
    "catalogs.view",
  ],
};

export const SYSTEM_ROLE_SLUGS = Object.keys(DEFAULT_ROLE_PERMISSIONS);

export function isValidPermission(permission) {
  return PERMISSION_VALUE_SET.has(permission);
}

export function normalizePermissionList(values = []) {
  return [...new Set(values)].filter(isValidPermission);
}
