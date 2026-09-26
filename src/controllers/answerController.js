import { pool } from '../config/db.js';


// save answer
export async function saveAnswerFun(req, res, next) {
	try {
		const { attempt_id, ques_id } = req.params;
		const { selected_option_id, answer_text } = req.body;

		// التحقق من وجود المحاولة
		const attempt = await pool.query(
			`select id from student_attempts where id = $1 and student_id = $2 and status = 'started'`,
			[attempt_id, req.userId]
		);
		if (attempt.rows.length === 0) {
			await pool.query('ROLLBACK');
			return res.status(404).json({
				success: false,
				message: 'المحاولة غير موجودة أو غير مفتوحة'
			});
		};

		// تحقق من وجود السؤال في الإختبار
		const quesInAttempt = await pool.query(
			`
			select q.id
			from student_attempts s_at
			join exam_questions e_qs
			on e_qs.exam_id = s_at.exam_id
			join questions q
			on q.id = e_qs.question_id
			where s_at.id = $1 and q.id = $2 and s_at.student_id = $3
			`,
			[attempt_id, ques_id, req.userId]
		);
		if (quesInAttempt.rows.length === 0) {
			return res.status(404).json({
				success: false,
				message: 'السؤال غير متوفر في الإختبار'
			});
		};

		// تصحيح الجواب ولما يكون صحيح بنرسله مع is_correct = true داخل  الاجوبة الخاصة بالطالب وبنجيبها من is_correct in option if selected_opt_id = ques_opts.id selecet is_correct or false if text
		let is_correct = false;
		if (selected_option_id) {
			const option = await pool.query(
				`
				select is_correct from question_options
				where id = $1 and question_id = $2
				`,
				[selected_option_id, ques_id]
			);
			if (option.rows.length === 0) {
				return res.status(404).json({
					success: false,
					message: 'هذا الاختيار غير موجود في السؤال'
				});
			};
			is_correct = option.rows[0]?.is_correct || false;
		};

		// إضافة الجواب
		const answer = await pool.query(
			`
			insert into student_answers(attempt_id, question_id, selected_option_id, answer_text, is_correct)
			values($1, $2, $3, $4, $5)
			on conflict(attempt_id, question_id)
			do update set
			selected_option_id = excluded.selected_option_id,
			answer_text = excluded.answer_text,
			is_correct = excluded.is_correct
			returning *
			`,
			[attempt_id, ques_id, selected_option_id, answer_text, is_correct]
		);

		// الرد
		res.status(201).json({
			success: true,
			answer: answer.rows[0]
		});
	} catch (error) {
		next(error);
	}
};

// get attempt answers
export async function getAttemptAnswers(req, res, next) {
	const client = await pool.connect();

	try {
		const { attempt_id } = req.params;

		// start transaction
		await client.query('BEGIN');

		// جلب بيانات المحاولة والتحقق من وجودها
		const attemptAnswers = await client.query(
			`
			select s_at.id,
			e.title,
			s_at.score,
			(select coalesce(sum(e_qs.points), 0)
			from exam_questions e_qs
			where e_qs.exam_Id = e.id) as total_points,
			coalesce(
				json_agg(
					json_build_object(
						'question_text', q.question_text,
						'correct_option_text', q_opts.option_text,
						'student_answer',
						case when s_an.selected_option_id is not null then q_opts.option_text
						else s_an.answer_text
						end,
						'is_correct', s_an.is_correct
					)
				) filter(where q.id is not null)
				,'[]'
			) as answer

			from student_attempts s_at
			join exams e
			on e.id = s_at.exam_id
			left join student_answers s_an
			on s_an.attempt_id = s_at.id
			left join questions q
			on q.id = s_an.question_id
			left join question_options q_opts
			on q_opts.id = s_an.selected_option_id
			where s_at.id = $1 and s_at.student_id = $2 and s_at.status != 'started'
			group by s_at.id, e.title, e.id, s_at.score
			`,
			[attempt_id, req.userId]
		);
		if (attemptAnswers.rows.length === 0) {
			await client.query('ROLLBACK');
			return res.status(404).json({
				success: false,
				message: 'المحاولة غير موجودة'
			});
		};

		// الرد
		res.status(200).json({
			success: true,
			value: attemptAnswers.rows[0]
		});
	} catch (error) {
		await client.query('ROLLBACK');
		next(error);
	} finally {
		client.release();
	}
};
