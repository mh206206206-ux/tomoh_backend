import jwt from 'jsonwebtoken';

export function verifyToken(req, res, next) {
	try {
		const authorizationHeader = req.headers.authorization;
		if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
			return res.status(401).json({
				success: false,
				message: 'غير مصرح: التوكن مفقود أو غير صحيح'
			});
		};

		// اختبار التوكن
		const token = authorizationHeader.split(' ')[1];

		const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
		req.userId = decoded.userId;

		next();
	} catch (error) {
		if (error.name === 'JsonWebTokenError') {
			return res.status(401).json({
        success: false,
        message: 'التوكن غير صحيح'
      });
		};
		if (error.name === 'TokenExpiredError') {
			return res.status(401).json({
				success: false,
				message: 'انتهت صلاحية التوكن, الرجاء تسجيل الدخول مجددا'
			});
		};
		next(error);
	}
};
