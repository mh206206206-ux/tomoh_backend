import { pool } from '../config/db.js';


// start attempt
export async function startAttemptFun(req, res, next) {
	const client = await pool.connect();

	try {
		const { exam_id } = req.params
		// start transaction
		await client.query('BEGIN');

		// التحقق من وجود الإختبار
		const exam = await client.query(
			`select id from exams where id = $1`,
			[exam_id]
		);
		if (exam.rows.length === 0) {
			await client.query('ROLLBACK');
			return res.status(404).json({
				success: false,
				message: 'الاختبار غير موجود'
			});
		};

		// التحقق من عدم وجود محاولات مفتوحة
		const openAttempt = await client.query(
			`select id from student_attempts where exam_id = $1 and student_id = $2 and status = 'started'`,
			[exam_id, req.userId]
		);
		if (openAttempt.rows.length > 0) {
			await client.query('ROLLBACK');
			return res.status(400).json({
				success: false,
				message: 'لديك اختبار مفتوح يجب إكماله أولا'
			});
		};

		// التحقق من لو كانت المحاولة موجودة ولكن مكتلمة
		const completedAttempt = await client.query(
			`select id from student_attempts where exam_id = $1 and student_id = $2 and status = 'completed'`,
			[exam_id, req.userId]
		);
		if (completedAttempt.rows.length > 0) {
			await client.query('ROLLBACK');
			return res.status(400).json({
				success: false,
				message: 'لقد اختبتر هذا الختبار من قبل لا يمكنك الإعادة'
			});
		};

		// التحقق لو كانت المحاولة موجودة ولكن إنتهى وقتها
		const autoSubmittedAttempt = await client.query(
			`select id from student_attempts where exam_id = $1 and student_id = $2 and status = 'auto_submitted'`,
			[exam_id, req.userId]
		);
		if (autoSubmittedAttempt.rows.length > 0) {
			await client.query(`ROLLBACK`);
			return res.status(400).json({
				success: false,
				message: 'لقد إنتهى الوقت قبل الإرسال, لا يمكنك الإعادة'
			});
		};

		// إنشاء محاولة جديدة
		const newAttempt = await client.query(
			`
			insert into student_attempts(exam_id, student_id, status) values($1, $2, 'started')
			returning id as attempt_id, started_at
			`,
			[exam_id, req.userId]
		);

		// معلومات الاختبار الحالي
		const examData = await client.query(
			`
			select e.title, e.duration_minutes,
			count(q.id) as questions_count,
			sum(e_qs.points) as total_points

			from exam_questions e_qs
			join exams e
			on e.id = e_qs.exam_id
			join questions q
			on q.id = e_qs.question_id
			where e.id = $1
			group by e.title, e.duration_minutes
			`,
			[exam_id]
		);
		if (examData.rows.length === 0) {
			await client.query('ROLLBACK');
			return res.status(404).json({
				success: false,
				message: 'الاختبار غير موجود لاختباره'
			});
		};

		await client.query('COMMIT');
		// الرد
		res.status(200).json({
			success: true,
			value: {
				exam: examData.rows[0].title,
				started_at: newAttempt.rows[0].started_at,
				duration_minutes: examData.rows[0].duration_minutes,
				questions_count: examData.rows[0].questions_count,
				total_points: examData.rows[0].total_points,
				attempt_id: newAttempt.rows[0].attempt_id
			}
		});
	} catch (error) {
		await client.query('ROLLBACK');
		next(error);
	} finally {
		client.release();
	}
};

// submitt attempt
export async function submittAttemptFun(req, res, next) {
	const client = await pool.connect();

	try {
		const { attempt_id } = req.params;
		// start transaction
		await client.query('BEGIN');

		// التحقق من وجود المحاولة + حالتها وأنها لنفس المستخدم الحالي
		const attempt = await client.query(
			`select id from student_attempts where id = $1 and student_id = $2 and status = 'started'`,
			[attempt_id, req.userId]
		);
		if (attempt.rows.length === 0) {
			await client.query('ROLLBACK');
			return res.status(404).json({
				success: false,
				message: 'المحاولة غير موجودة'
			});
		};

		// تحقق من انتهاء الوقت
		const examAttempt = await client.query(
			`
			select s_at.id as attempt_id, s_at.started_at,
			e.id as exam_id, e.duration_minutes

			from student_attempts s_at
			join exams e
			on e.id = s_at.exam_id
			where s_at.id = $1 and s_at.student_id = $2
			`,
			[attempt_id, req.userId]
		);
		const startedAt = new Date(examAttempt.rows[0].started_at).getTime();
		const durationMs = examAttempt.rows[0].duration_minutes * 60 * 1000;
		if (Date.now() > startedAt + durationMs) {
			await client.query(
				`update student_attempts set status = 'auto_submitted' where id = $1 and student_id = $2`,
				[attempt_id, req.userId]
			);
			await client.query('COMMIT');
			return res.status(400).json({
				success: false,
				message: 'لقد انتهى وقت الاختبار'
			});
		};

		// تحديث الدرجة  و الحالة و وقت الإرسال
		await client.query(
			`
			update student_attempts
			set score = (
				select coalesce(sum(e_qs.points), 0)
				from student_answers s_an
				join exam_questions e_qs
				on e_qs.exam_id = student_attempts.exam_id
				and e_qs.question_id = s_an.question_id

				where s_an.attempt_id = $1
					and s_an.is_correct = true
			),
			status = 'completed',
			submitted_at = NOW()

			where id = $1
			`,
			[attempt_id]
		);

		// جلب الاختبار المردود
		const resAttempt = await client.query(
			`
			select e.title,
			s_at.started_at, s_at.submitted_at,
			s_at.score,
			sum(e_qs.points) as total_points,
			extract(epoch from (s_at.submitted_at - s_at.started_at )) as duration_seconds

			from student_attempts s_at
			join exams e
			on e.id = s_at.exam_id
			join exam_questions e_qs
			on e_qs.exam_id = e.id
			where s_at.id = $1 and s_at.student_id = $2
			group by e.title, s_at.score, s_at.started_at, s_at.submitted_at
			`,
			[attempt_id, req.userId]
		);
		if (resAttempt.rows.length === 0) {
			await client.query('ROLLBACK');
			return res.status(404).json({
				success: false,
				message: 'النتيجة غير موجودة'
			});
		};

		await client.query('COMMIT');
		// الرد
		res.status(200).json({
			success: true,
			value: {
				exam: resAttempt.rows[0].title,
				score: resAttempt.rows[0].score,
				total_points: resAttempt.rows[0].total_points,
				submit_after: resAttempt.rows[0].duration_seconds
			}
		});
	} catch (error) {
		await client.query('ROLLBACK');
		next(error);
	} finally {
		client.release();
	}
};

// get my attempts
export async function getMyAttempts(req, res, next) {
	try {
		const attempts = await pool.query(
			`
			select s_at.id as attempt_id,
			s_at.status,
			e.title,
			s_at.score,
			coalesce(sum(e_qs.points), 0) as total_points

			from student_attempts s_at
			join exams e on e.id = s_at.exam_id
			left join exam_questions e_qs
			on e_qs.exam_id = s_at.exam_id
			where s_at.student_id = $1
			group by s_at.id, s_at.status, e.title, s_at.score
			order by s_at.id desc
			`,
			[req.userId]
		);
		if (attempts.rows.length === 0) {
			return res.status(200).json({
				success: true,
				message: 'ليس لديك أي محاولات إلى الآن'
			});
		};

		// الرد
		res.status(200).json({
			success: true,
			values: attempts.rows.map(att => ({
				attempt_id: att.attempt_id,
				status: att.status,
				exam: att.title,
				score: att.score,
				total_points: att.total_points
			}))
		});
	} catch (error) {
		next(error);
	}
};
