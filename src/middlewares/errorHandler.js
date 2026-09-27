export function errorHandler(err, req, res, next) {
	const status = err.status || err.statusCode || 500;
	const message = err.message || 'Server is Error';
	console.error('════════════════════════════');
  console.error('❌ ERROR MESSAGE:', err.message);
  console.error('❌ ERROR CODE:', err.code);
  console.error('❌ ERROR DETAIL:', err.detail);
  console.error('❌ ERROR STACK:', err.stack);
  console.error('════════════════════════════');
	res.status(status).json({ message });
};
