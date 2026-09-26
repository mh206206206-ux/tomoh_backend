import { pool } from '../config/db.js';
import { validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';


// register function
export async function registerFun(req, res, next) {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(400).json({
			success: false,
			errors: errors.array()
		});
	};
	try {
		const { name, email, password } = req.body;
		const fullEmail = email.toLowerCase().trim();

		// التحقق من أن الإيميل جديد
		const existEmail = await pool.query(
			`select id from users where email = $1`,
			[fullEmail]
		);
		if (existEmail.rows.length > 0) {
			return res.status(400).json({
				success: false,
				message: 'الحساب موجود بالفعل'
			});
		};

		// تشفير كلمة المرور
		const hashedPassword = await bcrypt.hash(password, 12);

		// تسجيل المستخدم
		await pool.query(
			`
			insert into users (name, email, password_hash)
			values ($1, $2, $3)
			`,
			[name, fullEmail, hashedPassword]
		);

		// الرد
		res.status(201).json({
			success: true,
			message: 'تم إنشاء حساب بنجاح'
		});
	} catch (error) {
		next(error);
	}
};

// login function
export async function loginFun(req, res, next) {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(400).json({
			errors: errors.array()
		});
	};
	try {
		const { email, password } = req.body;
		const fullEmail = email.toLowerCase().trim();

		// هل الحساب موجود؟
		const user = await pool.query(
			`select id, password_hash, role from users where email = $1`,
			[fullEmail]
		);
		if (!user.rows.length > 0) {
			return res.status(401).json({
				success: false,
				message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
			});
		};

		// الحساب موجود : مقارنة كلمة المرور
		const matchPassword = await bcrypt.compare(password.trim(), user.rows[0].password_hash);
		if (!matchPassword) {
			return res.status(400).json({
				success: false,
				message: 'البريد أو كلمة المرور غير صحيحة'
			});
		};

		// إنشاء توكن جديدة
		const access_token = jwt.sign(
			{ userId: user.rows[0].id },
			process.env.ACCESS_TOKEN_SECRET,
			{ expiresIn: '7d' }
		);

		// الرد
		res.status(200).json({
			success: true,
			token: access_token,
			role: user.rows[0].role
		});
	} catch (error) {
		next(error);
	}
};

// me function
export async function getMeFun(req, res, next) {
	try {
		// جلب بياناتي
		const meData = await pool.query(
			`select id, name, email, role, profile_image from users where id = $1`,
			[req.userId]
		);

		// التقق من وجودها
		if (meData.rows.length === 0) {
			return res.status(401).json({
				success: false,
				message: 'ليس لديك  حساب يجب تسجيل الدخول'
			});
		};

		// الرد
		res.status(200).json({
			success: true,
			user: meData.rows[0]
		});
	} catch (error) {
		next(error);
	}
};
