import { Router } from 'express';
import { createTenant, deleteTenant, getTenants, updateTenant } from '../controllers/tenant.controller.js';
import { PERMISSIONS } from '../constants/roles.js';
import auth from '../middleware/auth.js';
import requireClearance from '../middleware/requireClearance.js';

const router = Router();

router.use(auth);
router.use(requireClearance(PERMISSIONS.GLOBAL_ADMIN));

router.get('/', getTenants);
router.post('/', createTenant);
router.patch('/:tenantId', updateTenant);
router.delete('/:tenantId', deleteTenant);

export default router;
