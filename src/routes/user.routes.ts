import { Router } from 'express';
import { createUser, deleteUser, getUserById, getUsers, updateUser } from '../controllers/user.controller.js';
import { PERMISSIONS } from '../constants/roles.js';
import auth from '../middleware/auth.js';
import requireClearance from '../middleware/requireClearance.js';

const router = Router();

router.use(auth);
router.use(requireClearance(PERMISSIONS.MANAGE_USERS));

router.get('/', getUsers);
router.get('/:userId', getUserById);
router.post('/', createUser);
router.patch('/:userId', updateUser);
router.delete('/:userId', deleteUser);

export default router;
