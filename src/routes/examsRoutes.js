import express from 'express';
// middlewares
import { verifyToken } from '../middlewares/verifyToken.js';
import { isTeacher } from '../middlewares/isTeacher.js';
// validationrs
import { examValid } from '../validations/examValid.js';
// controolers
import {
	getAllExamsFun,
	getExamFun,
	addExamFun,
	editExamFun,
	deleteExamFun
} from '../controllers/examController.js';

const router = express.Router();

// code
router.use(verifyToken);

// get all exams
router.get('/exams', getAllExamsFun);

// get exam
router.get('/exams/:exam_id', getExamFun);

// add exam
router.post('/exams', isTeacher, examValid, addExamFun);

// edit exam
router.put('/exams/:exam_id', isTeacher, editExamFun)

// delete exam
router.delete('/exams/:exam_id', isTeacher, deleteExamFun);

// export
export default router;
