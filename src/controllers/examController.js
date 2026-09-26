import { pool } from "../config/db.js";
import { validationResult } from 'express-validator';


// select all exams teacher function
export async function getAllExamsFun(req, res, next) {
	try {
		// جلب الاختبارات ولو فاضية إرجاه مصفوفة
		const exams = await pool.query(
			`
			select u.name as teacher,
			e.id,
			e.title,
			e.duration_minutes,
			coalesce(sum(e_qs.points), 0) as total_points,
			count(q.id) as questions_count,
			e.start_at,
			e.end_at

			from users u
			join exams e
			on e.teacher_id = u.id
			left join exam_questions e_qs
			on e_qs.exam_id = e.id
			left join questions q
			on q.id = e_qs.question_id
			group by u.name, e.id, e.title, e.duration_minutes, e.start_at, e.end_at
			order by e.id desc
			`
		);
		if (exams.rows.length === 0) {
			return res.status(200).json({
				success: true,
				message: 'لا يوجد لديك أي اختبار إلى الآن'
			});
		};

		// الرد
		res.status(200).json({
			success: true,
			exams: exams.rows.map(exam => ({
				teacher: exam.teacher,
				values: {
					id: exam.id,
					title: exam.title,
					duration: exam.duration_minutes,
					points: exam.total_points,
					questions_count: exam.questions_count,
					start: exam.start_at,
					end: exam.end_at,
					questions: exam.questions
				}
			}))
		});
	} catch (error) {
		next(error);
	}
};

// select exam function
export async function getExamFun(req, res, next) {
	try {
		const { exam_id } = req.params;

		// جلب السؤال + التحقق
		const exam = await pool.query(
			`
			select u.name as teacher,
			e.id,
			e.title,
			e.duration_minutes,
			coalesce(sum(e_qs.points), 0) as total_points,
			e.start_at,
			e.end_at,
			coalesce(
				json_agg(
					json_build_object(
						'question_text', q.question_text,
						'question_type', q.question_type,
						'default_points', q.default_points,
						'difficulty', q.difficulty
					)
				) filter (where q.id is not null)
			,'[]') as questions

			from users u
			join exams e
			on e.teacher_id = u.id
			join exam_questions e_qs
			on e_qs.exam_id = e.id
			left join questions q
			on q.id = e_qs.question_id
			where e.id = $1
			group by u.name, e.id, e.title, e.duration_minutes, e.start_at, e.end_at
			`,
			[exam_id, req.userId]
		);
		if (exam.rows.length === 0) {
			return res.status(404).json({
				success: false,
				message: 'الاختبار غير متوفر لديك'
			});
		};

		// الرد
		res.status(200).json({
			success: true,
			value: {
				teacher: exam.rows[0].teacher,
				exam: {
					id: exam.rows[0].id,
					title: exam.rows[0].exam,
					duration_minutes: exam.rows[0].duration_minutes,
					points: exam.rows[0].total_points,
					start: exam.rows[0].start_at,
					end: exam.rows[0].end_at,
					questions: exam.rows[0].questions
				}
			}
		});
	} catch (error) {
		next(error);
	}
};

// add exam function
export async function addExamFun(req, res, next) {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(400).json({
			success: false,
			errors: errors.array()
		});
	};

	const client = await pool.connect();
	try {
		// جلب البيانات
		const { title, duration_minutes, start_at, end_at, questions } = req.body;

		// التحقق من وجود سؤال على الأقل
		if (!questions || questions.length === 0) {
			return res.status(400).json({
				success: false,
				message: 'يجب إضافة سؤال واحد على الأقل'
			});
		};

		// start transaction
		await client.query('BEGIN');

		// إضافة الاختبار
		const newExam = await client.query(
			`
			insert into exams(teacher_id, title, duration_minutes, start_at, end_at)
			values($1, $2, $3, $4, $5)
			returning id
			`,
			[req.userId, title, duration_minutes, start_at, end_at]
		);

		// إضافة الأسئلة
		for (let i = 0; i < questions.length; i++) {
			// تحديد نقاط السؤال + التحق من وجوده
			const quesPoints = await client.query(
				`select default_points from questions where id = $1 and teacher_id = $2`,
				[questions[i], req.userId]
			);
			if (quesPoints.rows.length === 0) {
				await client.query('ROLLBACK');
				return res.status(404).json({
					success: false,
					message: `السؤال ${questions[i]} غير موجود عندك`
				});
			};

			// الإضافة
			await client.query(
				`insert into exam_questions(exam_id, question_id, points) values($1, $2, $3)`,
				[newExam.rows[0].id, questions[i], quesPoints.rows[0].default_points]
			);
		};

		// الاختبار المردود
		const resExamQuestions = await client.query(
			`
			select u.name as teacher,
			e.id,
			e.title,
			e.duration_minutes,
			coalesce(sum(e_qs.points), 0) as total_points,
			e.start_at,
			e.end_at,
			coalesce(
				json_agg(
					json_build_object(
						'question_text', q.question_text,
						'question_type', q.question_type,
						'default_points', q.default_points,
						'difficulty', q.difficulty
					) 
				) filter(where q.id is not null)
				,'[]'
			) as questions
			
			from users u
			join exams e
			on e.teacher_id = u.id
			join exam_questions e_qs
			on e_qs.exam_id = e.id
			left join questions q
			on q.id = e_qs.question_id
			where e.id = $1 and u.id = $2
			group by u.name, e.id, e.title, e.duration_minutes, e.start_at, e.end_at
			`,
			[newExam.rows[0].id, req.userId]
		);
		if (resExamQuestions.rows.length === 0) {
			await client.query('ROLLBACK');
			return res.status(404).json({
				success: false,
				message: 'الاختبار غير موجود'
			});
		};

		await client.query('COMMIT');
		// الرد
		res.status(201).json({
			success: true,
			message: 'تم إضافة الاختبار بنجاح',
			teacher: resExamQuestions.rows[0].teacher,
			exam: {
				id: resExamQuestions.rows[0].id,
				title: resExamQuestions.rows[0].title,
				duration: resExamQuestions.rows[0].duration_minutes,
				points: resExamQuestions.rows[0].total_points,
				start: resExamQuestions.rows[0].start_at,
				end: resExamQuestions.rows[0].end_at,
				questions: resExamQuestions.rows[0].questions
			}
		});
	} catch (error) {
		await client.query('ROLLBACK');
		next(error);
	} finally {
		client.release();
	}
};

// edit exam function
export async function editExamFun(req, res, next) {
	// حجز قطعة اتصال بالقاعدة خاصة بهذه الوظيفة
	const client = await pool.connect();

	try {
		const { exam_id } = req.params;
		const { title, duration_minutes, start_at, end_at, questions } = req.body;

		// start transaction
		await client.query('BEGIN');

		// التحديث + التحقق
		const updateExam = await client.query(
			`
			update exams set title = coalesce($1, title),
			duration_minutes = coalesce($2, duration_minutes),
			start_at = coalesce($3, start_at),
			end_at = coalesce($4, end_at)

			where id = $5 and teacher_id = $6
			returning id
			`,
			[title, duration_minutes, start_at, end_at, exam_id, req.userId]
		);
		if (updateExam.rows.length === 0) {
			await client.query('ROLLBACK');
			return res.status(404).json({
				success: false,
				message: 'الاختبار غير متوفر لديك'
			});
		};

		// تحديث الأسئلة الخاصة بالاختبار
		if (questions) {
			// حذف الأسئلة القديمة
			await client.query(
				`delete from exam_questions where exam_id = $1`,
				[exam_id]
			);
			for (let i = 0; i < questions.length; i++) {
				// جلب النقاط الجديدة
				const quesPoints = await client.query(
					`select q.default_points from questions q where id = $1 teacher_id = $2`,
					[questions[i], req.userId]
				);

				// تحديث الأسئلة
				await pool.query(
					`insert into exam_questions(exam_id, question_id, points) values($1, $2, $3)`,
					[exam_id, questions[i], quesPoints.rows[0].default_points]
				);
			};
		};

		// الاختبار الجديد المردود + تحقق ثاني 
		const updateResExamQuestions = await client.query(
			`
			select u.name as teacher,
			e.id,
			e.title,
			e.duration_minutes,
			coalesce(sum(e_qs.points), 0) as total_points,
			e.start_at,
			e.end_at,
			coalesce(
				json_agg(
					json_build_object(
						'question_text', q.question_text,
						'question_type', q.question_type,
						'default_points', q.default_points,
						'difficulty', q.difficulty
					)
				) filter(where q.id is not null)
				,'[]'
			) as questions

			from users u
			join exams e
			on e.teacher_id = u.id
			join exam_questions e_qs
			on e_qs.exam_id = e.id
			left join questions q
			on q.id = e_qs.question_id
			where e.id = $1 and u.id = $2
			group by u.name, e.id, e.title, e.duration_minutes, e.start_at, e.end_at
			`,
			[exam_id, req.userId]
		);
		if (updateResExamQuestions.rows.length === 0) {
			await client.query('ROLLBACK');
			return res.status(404).json({
				success: false,
				message: 'الاختبار غير متوفر لديك'
			});
		};

		await client.query('COMMIT');
		// الرد
		res.status(200).json({
			success: true,
			message: 'تم التحديث بنجاح',
			value: {
				teacher: updateResExamQuestions.rows[0].teacher,
				exam: {
					title: updateResExamQuestions.rows[0].title,
					duration: updateResExamQuestions.rows[0].duration_minutes,
					total_points: updateResExamQuestions.rows[0].total_points,
					start: updateResExamQuestions.rows[0].start_at,
					end: updateResExamQuestions.rows[0].end_at,
					questions: updateResExamQuestions.rows[0].questions
				}
			}
		});
	} catch (error) {
		await client.query('ROLLBACK');
		next(error);
	} finally {
		client.release(); // ?
	}
};

// delete exam function
export async function deleteExamFun(req, res, next) {
	try {
		const { exam_id } = req.params;

		// حذف السؤال + التحقق
		const deletedExam = await pool.query(
			`delete from exams  whereid = $1 and teacher_id = $2 returning id`,
			[exam_id, req.userId]
		);
		if (deletedExam.rows.length === 0) {
			return res.status(404).json({
				success: false,
				message: 'الاختبار غير متوفر لديك'
			});
		};

		// الرد
		res.status(200).json({
			success: true,
			message: 'تم حذف الاختبار بنجاح',
			exam: deletedExam.rows[0].id
		});
	} catch (error) {
		next(error);
	}
};
