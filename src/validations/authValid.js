import { body } from 'express-validator';

// register valid
export const registerValid = [
	// name
	body('name').optional().isLength({ min: 2 })
		.withMessage('الاسم قصير جدا, أقل اسم يتكون من حرفين')
		.isLength({ max: 255 })
		.withMessage('الاسم طويل جدا, أطول اسم يتكون من 255 حرف')
		.matches(/^[\u0600-\u06FFa-zA-Z\s]+$/)
		.withMessage('الاسم يحتوي على رموز غير مسموحة'),

	// email
	body('email').toLowerCase().trim().notEmpty()
		.withMessage('البريد مطلوب')
		.isEmail()
		.withMessage('البريد مكتوب بطريقة غير صحيحة')
		.normalizeEmail() // خالي من ال. + الزائدة لتوحيد الإيميلات في قاعدة البيانات
		.withMessage('البريد غير طبيعي')
	,

	// password
	body('password').trim().notEmpty()
		.withMessage('كلمة المرور مطلوبة')
		.isStrongPassword({
			minLength: 8,
			minLowercase: 1,
			minUppercase: 1,
			minNumbers: 1,
			minSymbols: 1 // الي هي الرموز
		})
		.withMessage('كلمة المرور ضعيفة تحتاج إلى 8 أحرف موزعة على الأقل  (حرف صغير, حرف كبير, رقم, رمز)')
		.custom((value, { req }) => {
			if (value.includes(req.body.name) || value.includes(req.body.email)) {
				throw new Error('كلمة المرور لا يجب أن تحتوي على اسمك أو بريدك')
			};
			return true;
		}),

	// role
	body('role').optional().isIn(['student', 'teacher', 'admin'])
		.withMessage('الصلاحية غير صحيحة'),

	// profile_image
	body('profile_image').optional().isURL()
		.withMessage('رابط الصورة غير صحيح')
];

// login valid
export const loginValid = [
	// email
	body('email').toLowerCase().trim().notEmpty()
		.withMessage('البريد مطلوب')
		.isEmail()
		.withMessage('البريد مكتوب بطريقة غير صحيحة')
		.normalizeEmail() // خالي من ال. + الزائدة لتوحيد الإيميلات في قاعدة البيانات
		.withMessage('البريد غير طبيعي'),

	// password
	body('password').trim().notEmpty()
		.withMessage('كلمة المرور مطلوبة')
		.isLength({min: 8})
		.withMessage('كلمة المرور يجب أن تحتوي على 8 خانات على الأقل')
];
