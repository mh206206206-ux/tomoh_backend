import express from 'express';
// middlewares
import { verifyToken } from '../middlewares/verifyToken.js';
import { isTeacher } from '../middlewares/isTeacher.js';
// validations
import { questionValid } from '../validations/questionValid.js';
// controllers
import {
	getAllQuesFun,
	getQuesFun,
	addQuesFun,

	addOptoinsFun,
	editOptionFun,
	delteOptionFun,
	deleteQuesFun,
	editQuesFun,

} from '../controllers/questionController.js';

const router = express.Router();

// routes
router.use(verifyToken);

// get questions
router.get('/questions', isTeacher, getAllQuesFun);

// get question
router.get('/questions/:ques_id', isTeacher, getQuesFun);

// add question
router.post('/questions', isTeacher, questionValid, addQuesFun);

// add options
router.post('/questions/:ques_id', isTeacher, addOptoinsFun);

// edit option
router.put('/questions/:ques_id/:opt_id', isTeacher, editOptionFun);

// delete optoin
router.delete('/questions/:ques_id/:opt_id', isTeacher, delteOptionFun);

// edit question
router.put('/questions/:ques_id', isTeacher, editQuesFun);

// delete question
router.delete('/questions/:ques_id', isTeacher, deleteQuesFun)


// export
export default router;
