export function errorHandler(err, req, res, next) {
	const status = err.status || err.statusCode || 500;
	const message = err.message || 'Server is Error';
	res.status(status).json({ message });
};
