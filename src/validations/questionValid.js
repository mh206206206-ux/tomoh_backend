import { body } from "express-validator";

// question valid
export const questionValid = [
	// question_text
	body('question_text').trim().notEmpty()
		.withMessage('اسم السؤال مطلوب'),

	// question_type
	body('question_type').notEmpty()
	.isIn(['multiple_choice', 'fill_blank', 'true_false', 'matching'])
		.withMessage('هذا النوع من الأسئلة غير متوفر حاليا'),

	// default_points
	body('default_points').optional().isInt({min: 1, max: 20})
		.withMessage('النقاط يجب أن تكون رقما بين 1 و 20'),

	// difficulty
	body('difficulty').notEmpty()
		.withMessage('صعوبة السؤال مطلوبة')
	.isIn(['hard', 'medium', 'easy'])
		.withMessage('الصعوبات هي (صعب, متوسط, سهل)')
];
