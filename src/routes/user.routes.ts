import { Router } from 'express';
import { createUser } from '../controllers/user.controller.js';
import { PERMISSIONS } from '../constants/roles.js';
import auth from '../middleware/auth.js';
import requireClearance from '../middleware/requireClearance.js';

const router = Router();

router.use(auth);
router.post('/', requireClearance(PERMISSIONS.MANAGE_USERS), createUser);

export default router;
