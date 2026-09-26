import express from 'express';
// middlewares
import { verifyToken } from '../middlewares/verifyToken.js';
// controllers
import {
	startAttemptFun,
	submittAttemptFun,
	getMyAttempts,
} from '../controllers/attemptController.js';

const router = express.Router();


// code
router.use(verifyToken);
// start attempt
router.post('/exams/:exam_id/start', startAttemptFun);

// submit attempt
router.post('/attempts/:attempt_id/submit', submittAttemptFun);

// get my attempts
router.get('/profile/attempts', getMyAttempts);

// export router
export default router;
