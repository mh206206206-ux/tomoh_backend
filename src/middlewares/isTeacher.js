import { pool } from "../config/db.js";

export async function isTeacher(req, res, next) {
	try {
		const user = await pool.query(
			`select role from users where id = $1`,
			[req.userId]
		);
		if (!user.rows.length > 0) {
			return res.status(404).json({
				success: false,
				message: 'الحساب غير موجود'
			});
		};

		// التحقق من الصلاحية
		if (user.rows[0].role !== 'teacher') {
			return res.status(403).json({
				success: false,
				message: 'غير مصرح'
			});
		};
		next();
	} catch (error) {
		next(error);
	}
};
