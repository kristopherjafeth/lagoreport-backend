-- Actualiza los permisos predeterminados para los roles del sistema

UPDATE `Role`
SET `permissions` = JSON_ARRAY(
  'dashboard.view',
  'reports.view',
  'reports.create',
  'reports.update',
  'reports.delete',
  'reports.export',
  'customers.view',
  'customers.create',
  'customers.update',
  'customers.delete',
  'captains.view',
  'captains.create',
  'captains.update',
  'captains.delete',
  'vessels.view',
  'vessels.create',
  'vessels.update',
  'vessels.delete',
  'greenhouses.view',
  'greenhouses.create',
  'greenhouses.update',
  'greenhouses.delete',
  'plans.view',
  'plans.create',
  'plans.update',
  'plans.delete',
  'catalogs.view',
  'catalogs.create',
  'catalogs.update',
  'catalogs.delete',
  'users.view',
  'users.create',
  'users.update',
  'users.delete',
  'users.assign',
  'roles.view',
  'roles.create',
  'roles.update',
  'roles.delete',
  'roles.manage-permissions',
  'commands.send',
  'commands.view'
)
WHERE `slug` = 'admin';

UPDATE `Role`
SET `permissions` = JSON_ARRAY(
  'dashboard.view',
  'reports.view',
  'reports.create',
  'reports.update',
  'reports.export',
  'customers.view',
  'customers.update',
  'captains.view',
  'captains.update',
  'vessels.view',
  'vessels.update',
  'greenhouses.view',
  'greenhouses.update',
  'plans.view',
  'catalogs.view',
  'users.view',
  'users.update',
  'roles.view',
  'commands.send',
  'commands.view'
)
WHERE `slug` = 'moderator';

UPDATE `Role`
SET `permissions` = JSON_ARRAY(
  'dashboard.view',
  'reports.view',
  'customers.view',
  'captains.view',
  'vessels.view',
  'greenhouses.view',
  'catalogs.view'
)
WHERE `slug` = 'user';
