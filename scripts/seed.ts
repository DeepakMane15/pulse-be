import mongoose from 'mongoose';
import { connectMongo } from '../src/config/db.js';
import logger from '../src/config/logger.js';
import { ROLE_CLEARANCE } from '../src/constants/roles.js';
import { hashPassword } from '../src/services/auth.service.js';
import Role from '../src/models/role.model.js';
import Tenant from '../src/models/tenant.model.js';
import User from '../src/models/user.model.js';

const DEFAULT_TENANT_NAME = 'Pulse';
const DEFAULT_TENANT_SLUG = 'pulse';
const DEFAULT_SUPER_ADMIN_EMAIL = 'admin@pulsegen.io';
const DEFAULT_SUPER_ADMIN_PASSWORD = 'admin';

async function seedRoles(): Promise<void> {
  const roleNames = Object.keys(ROLE_CLEARANCE) as Array<keyof typeof ROLE_CLEARANCE>;

  for (const roleName of roleNames) {
    const clearanceLevel = ROLE_CLEARANCE[roleName];
    await Role.findOneAndUpdate(
      { name: roleName },
      { name: roleName, clearanceLevel },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  logger.info(`seed roles completed for ${roleNames.length} roles`);
}

async function seedPulseTenant() {
  const tenant = await Tenant.findOneAndUpdate(
    { slug: DEFAULT_TENANT_SLUG },
    {
      name: DEFAULT_TENANT_NAME,
      slug: DEFAULT_TENANT_SLUG,
      status: 'active',
      createdBy: null
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  logger.info(`seed tenant ensured: ${tenant.name} (${tenant._id})`);
  return tenant;
}

async function seedSuperAdmin(tenantId: mongoose.Types.ObjectId): Promise<void> {
  const superAdminRole = await Role.findOne({ name: 'super_admin' });
  if (!superAdminRole) {
    throw new Error('super_admin role not found. Ensure roles seed runs first.');
  }

  const hashedPassword = await hashPassword(DEFAULT_SUPER_ADMIN_PASSWORD);

  const user = await User.findOneAndUpdate(
    { email: DEFAULT_SUPER_ADMIN_EMAIL },
    {
      email: DEFAULT_SUPER_ADMIN_EMAIL,
      password: hashedPassword,
      tenantId,
      roleId: superAdminRole._id,
      isActive: true,
      createdBy: null
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );

  if (!user.createdBy) {
    user.createdBy = user._id;
    await user.save();
  }

  logger.info(`seed super_admin ensured: ${user.email} (${user._id})`);
}

async function runSeed(): Promise<void> {
  logger.info('seed IN');

  try {
    await connectMongo();
    await seedRoles();
    const tenant = await seedPulseTenant();
    await seedSuperAdmin(tenant._id);
    logger.info('seed completed successfully');
  } catch (error: any) {
    logger.error(`seed failed: ${error.message}`);
    throw error;
  } finally {
    await mongoose.connection.close();
    logger.info('seed OUT');
  }
}

runSeed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
