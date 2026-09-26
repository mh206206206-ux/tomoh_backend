import { body } from "express-validator";

// exam valid
export const examValid = [
	// titlie
	body('title').trim().notEmpty()
		.withMessage('عنوان السؤال مطلوب')
	.isLength({min: 2, max: 250})
		.withMessage('المؤقت يجب أن يكون رقما بين 2 و 250'),

	// duration
	body('duration_minutes').trim().notEmpty()
		.withMessage('مؤقت الاختبار مطلوب')
	.isInt()
		.withMessage('المؤقت يجب أن يكون رقما'),

	// start_at
	body('start_at').trim().notEmpty()
		.withMessage('تاريخ البدء مطلوب')
	.isISO8601()
		.withMessage('يجب كتابة التاريخ بشكل صحيح'),

	// end_at
	body('end_at').trim().notEmpty()
		.withMessage('تاريخ الانتهاء مطلوب')
	.isISO8601()
		.withMessage('يجب كتابة التاريخ بشكل صحيح')
];
