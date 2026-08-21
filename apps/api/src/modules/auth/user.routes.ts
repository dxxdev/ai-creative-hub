import { Router } from 'express';
import { authGuard } from '../../middlewares/authGuard.js';

const router = Router();

router.get('/me', authGuard, (req, res) => {
  res.status(200).json({
    success: true,
    data: { user: req.user },
  });
});

export default router;