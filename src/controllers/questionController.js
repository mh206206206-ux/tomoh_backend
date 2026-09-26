import { pool } from "../config/db.js";
import { validationResult } from "express-validator";

// select questoins function
export async function getAllQuesFun(req, res, next) {
	try {
		const questions = await pool.query(
			`
			select u.name as teacher,
			q.id,
      q.question_text,
      q.question_type,
      q.default_points,
      q.difficulty,
			coalesce(
				json_agg(
					json_build_object(
						'option_text', q_opts.option_text,
						'is_correct', q_opts.is_correct
					)
				)
				, '[]'
			) as options

			from users u 
			join questions q
			on q.teacher_id = u.id
			left join question_options q_opts
			on q_opts.question_id = q.id
			where u.id = $1
			group by u.name, q.id, q.question_text, q.question_type, q.default_points, q.difficulty
			`,
			[req.userId]
		);
		if (!questions.rows.length > 0) {
			return res.status(200).json({
				success: true,
				message: 'لا يوجد أسئلة مضافة بعد.'
			});
		};

		// الرد
		res.status(200).json({
			success: true,
			questions: {
				teacher: questions.rows[0].teacher,
				question: questions.rows.map(row => ({
					id: row.id,
					question_text: row.question_text,
					question_type: row.question_type,
					default_points: row.default_points,
					difficulty: row.difficulty,
					options: row.options
				}))
			}
		});
	} catch (error) {
		next(error);
	}
};

// select quesiton function
export async function getQuesFun(req, res, next) {
	try {
		const { ques_id } = req.params;

		// السؤال + التحقق من أنه موجود
		const question = await pool.query(
			`
			select u.name as teacher,
			q.id,
			q.question_text,
			q.question_type,
			q.default_points,
			q.difficulty,
			coalesce(
				json_agg(
					json_build_object(
						'id', q_opts.id,
						'option_text', q_opts.option_text,
						'is_correct', q_opts.is_correct
					)
				),
				'[]'
			) as options

			from users u
			join questions q
			on q.teacher_id = u.id
			left join question_options q_opts
			on q_opts.question_id = q.id

			where q.id = $1
			and u.id = $2
			group by u.name, q.id, q.question_text, q.question_type, q.default_points, q.difficulty
			`,
			[ques_id, req.userId]
		);
		if (question.rows.length === 0) {
			return res.status(404).json({
				success: false,
				message: 'ليس لديك هذا السؤال'
			});
		};

		// الرد
		res.status(200).json({
			success: true,
			teacher: question.rows[0].teacher,
			question: {
				id: question.rows[0].id,
				question_text: question.rows[0].question_text,
				question_type: question.rows[0].question_type,
				default_points: question.rows[0].default_points,
				difficulty: question.rows[0].difficulty,
				options: question.rows[0].options
			}
		});
	} catch (error) {
		next(error);
	}
};

// add question function
export async function addQuesFun(req, res, next) {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(400).json({
			success: false,
			errors: errors.array()
		});
	};
	// set for transactoin
	const client = await pool.connect();

	try {
		const { question_text, question_type, default_points, difficulty } = req.body;

		// start transaction
		await client.query('BEGIN');

		// إضافة السؤال
		const newQuestion = await client.query(
			`
			insert into questions(teacher_id ,question_text, question_type, default_points, difficulty)
			values($1, $2, $3, $4, $5)
			returning id
			`,
			[req.userId, question_text, question_type, default_points, difficulty]
		);

		// السؤال المردود
		const resQuestion = await client.query(
			`
			select u.name as teacher,
			q.id,
			q.question_text,
			q.question_type,
			q.default_points,
			q.difficulty

			from users u
			join questions q
			on q.teacher_id = u.id
			where q.id = $1 and u.id = $2
			`,
			[newQuestion.rows[0].id, req.userId]
		);
		if (resQuestion.rows.length === 0) {
			await client.query('ROLLBACK');
			return res.status().json({
				success: false,
				message: 'السؤال غير متوفر لديك'
			});
		};

		await client.query('COMMIT');
		// الرد
		res.status(201).json({
			success: true,
			value: {
				teacher: resQuestion.rows[0].teacher,
				question: {
					id: resQuestion.rows[0].id,
					question_text: resQuestion.rows[0].question_text,
					question_type: resQuestion.rows[0].question_type,
					default_points: resQuestion.rows[0].default_points,
					difficulty: resQuestion.rows[0].difficulty
				}
			}
		});
	} catch (error) {
		await client.query('ROLLBACK');
		next(error);
	} finally {
		client.release();
	}
};

// add options
export async function addOptoinsFun(req, res, next) {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(400).json({
			success: false,
			errors: errors.array()
		});
	};
	try {
		const { ques_id } = req.params;
		const { options } = req.body;

		if (!options || options.length === 0) {
			return res.status(404).json({
				success: false,
				message: 'يجب إضافة خيار واحد على الأقل.'
			});
		};

		// التأكد من أن الإضافة لسؤال المعلم
		const check = await pool.query(
			`select id from questions where id = $1 and teacher_id = $2`,
			[ques_id, req.userId]
		);
		if (!check.rows.length > 0) {
			return res.status(404).json({
				success: false,
				message: 'ليس لديك هذا السؤال'
			});
		};

		// إضافة الخيارات
		for (let opt = 0; opt < options.length; opt++) {
			await pool.query(
				`
				insert into question_options(question_id, option_text, is_correct)
				values($1, $2, $3)
				`,
				[ques_id, options[opt].option_text, options[opt].is_correct]
			);
		};

		// جلب السؤال مع الخيارات
		const question = await pool.query(
			`
			select q.question_text,
			q_opts.id,
			q_opts.option_text,
			q_opts.is_correct

			from questions q
			join question_options q_opts
			on q_opts.question_id = q.id
			where q.id = $1
			`,
			[ques_id]
		);

		// التحقق من وجود السؤال
		if (question.rows.length === 0) {
			return res.status(404).json({
				success: false,
				message: 'السؤال غير موجود'
			});
		};

		// الرد
		res.status(201).json({
			success: true,
			question: {
				question_text: question.rows[0].question_text,
				options: question.rows.map(row => ({
					id: row.id,
					option_text: row.option_text,
					is_correct: row.is_correct
				}))
			}
		});
	} catch (error) {
		next(error);
	}
};

// edit option
export async function editOptionFun(req, res, next) {
	try {
		const { ques_id, opt_id } = req.params;
		const { option_text, is_correct } = req.body;

		// التأكد من وجود السؤال + السؤال خاص بهذا المعلم
		const question = await pool.query(
			`select teacher_id from questions where id = $1 and teacher_id = $2`,
			[ques_id, req.userId]
		);
		if (question.rows.length === 0) {
			return res.status(404).json({
				success: false,
				message: 'السؤال غير موجود لديك'
			});
		};

		// التحقق من وجود السؤال والخيار
		const newOption = await pool.query(
			`
			update question_options
			set option_text = coalesce($1, option_text),
			is_correct = coalesce($2, is_correct)

			where question_id = $3
			and id = $4
			returning *
			`,
			[option_text, is_correct, ques_id, opt_id]
		);
		if (!newOption.rows.length > 0) {
			return res.status(404).json({
				success: false,
				message: 'الخيار الذي تريد تعديله غير موجود'
			});
		};

		// الرد
		res.status(200).json({
			success: true,
			newOption: newOption.rows[0]
		});
	} catch (error) {
		next(error);
	}
};

// delete option
export async function delteOptionFun(req, res, next) {
	try {
		const { ques_id, opt_id } = req.params;

		// التحقق من وجود السؤال + خاص بامعلم
		const question = await pool.query(
			`select teacher_id from questions where id = $1`,
			[ques_id]
		);
		if (question.rows.length === 0) {
			return res.status(404).json({
				success: false,
				message: 'السؤال غير متوفر لديك'
			});
		};

		// حذف الإجابة إذا كانت موجودة
		const deleteQues = await pool.query(
			`delete from question_options where question_id = $1 and id = $2 returning *`,
			[ques_id, opt_id]
		);
		if (!deleteQues.rows.length > 0) {
			return res.status(404).json({
				success: false,
				message: 'الخيار غير موجود'
			});
		};

		// الرد
		res.status(200).json({
			success: true
		});
	} catch (error) {
		next(error);
	}
};

// edit question function
export async function editQuesFun(req, res, next) {
	try {
		const { ques_id } = req.params;
		const { question_text, question_type, default_points, difficulty } = req.body;

		// جلب السؤال + التحقق منه
		const question = await pool.query(
			'select  id from questions where id = $1 and teacher_id = $2',
			[ques_id, req.userId]
		);
		if (question.rows.length === 0) {
			return res.status(404).json({
				success: false,
				message: 'السؤال غير متوفر لديك'
			});
		};

		// تعديل السؤال
		const updatedQues = await pool.query(
			`
			update questions
			set question_text = coalesce($1, question_text),
			question_type = coalesce($2, question_type),
			default_points = coalesce($3, default_points),
			difficulty = coalesce($4, difficulty)

			where id = $5 and teacher_id = $6
			returning question_text, question_type, default_points, difficulty
			`,
			[question_text, question_type, default_points, difficulty, question.rows[0].id, req.userId]
		);

		// الرد
		res.status(200).json({
			success: true,
			message: 'تم تعديل السؤال بنجاح',
			updatedQues: updatedQues.rows[0]
		});
	} catch (error) {
		next(error);
	}
};

// delete question function
export async function deleteQuesFun(req, res, next) {
	try {
		const { ques_id } = req.params;

		// جلب السؤال + التحقق من وجوده
		const question = await pool.query(
			`delete from questions where id = $1 and teacher_id = $2 returning id`,
			[ques_id, req.userId]
		);
		if (question.rows.length === 0) {
			res.status(404).json({
				success: false,
				message: 'السؤال غير متوفر لديك'
			});
		};

		// الرد
		res.status(200).json({
			success: true,
			message: 'تم حذف السؤال بنجاح',
			deleted: question.rows[0].id
		});
	} catch (error) {
		next(error);
	}
};
