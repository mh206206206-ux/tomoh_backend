import express from 'express';
// middlewares
import { verifyToken } from '../middlewares/verifyToken.js';
// validations
import { registerValid, loginValid } from '../validations/authValid.js';
// controllers
import { registerFun, loginFun, getMeFun } from '../controllers/authController.js';

const router = express.Router();

// routes
// register
router.post('/register', registerValid, registerFun);

// login
router.post('/login', loginValid, loginFun );

// get me
router.get('/me', verifyToken, getMeFun);

// export default
export default router;
