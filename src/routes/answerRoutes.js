import express from 'express';
// middlewares
import { verifyToken } from '../middlewares/verifyToken.js';
// controllers
import { saveAnswerFun, getAttemptAnswers } from '../controllers/answerController.js';

const router = express.Router();


// code
router.use(verifyToken);

// save answer
router.post('/attempts/:attempt_id/:ques_id/answer', saveAnswerFun);

// get attempt answers
router.get('/attempts/:attempt_id', getAttemptAnswers);


// export default
export default router;
