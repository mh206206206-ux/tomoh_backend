import dotenv from 'dotenv';
import express from 'express';
// middleware
import { errorHandler } from './middlewares/errorHandler.js';
// secure
import cors from 'cors';
import limiter from 'express-rate-limit';
// routers
import authRoutes from './routes/authRoutes.js';
import questionsRoutes from './routes/questionsRoutes.js';
import examsRoutes from './routes/examsRoutes.js';
import attemptRoutes from './routes/attemptRoutes.js';
import answerRoutes from './routes/answerRoutes.js';

const app = express();


// code
dotenv.config();
app.use(express.json());

// secure
app.use(cors({
	origin: ['http://localhost:8080']
}));
// limitrs
const authLimiter = limiter({
	windowMs: 30 * 60 * 1000,
	max: 10,
	message: 'لقد تجاوزت الحد في الطلب حاول بعد نصف ساعة',
	skip: req => req.path === '/me'
});

// routes
// auth
app.use('/api/auth', authLimiter, authRoutes);

// questions
app.use('/api', questionsRoutes);

// exams
app.use('/api', examsRoutes);

// attempt
app.use('/api', attemptRoutes);

// answer
app.use('/api', answerRoutes);

// error handler
app.use(errorHandler);

// listen
app.listen(process.env.PORT || 5000, () => {
	console.log(`server is run on port ${process.env.PORT || 5000}`)
});
