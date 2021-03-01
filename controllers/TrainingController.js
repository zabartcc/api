import express from 'express';
const router = express.Router();
import transporter from '../config/mailer.js';
import TrainingSession from '../models/TrainingSession.js';
import TrainingRequest from '../models/TrainingRequest.js';
import TrainingMilestone from '../models/TrainingMilestone.js';
import User from '../models/User.js';

router.get('/request/upcoming/:id', async (req, res) => {
	try {
		const upcoming = await TrainingRequest.find({
			student: req.params.id, 
			deleted: false,
			startTime: {
				$gt: new Date(new Date().toUTCString()) // request is in the future
			},
		}).populate('instructor', 'fname lname cid').populate('milestone', 'code name').sort({startTime: "asc"}).lean();
		res.stdRes.data = upcoming;
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.get('/request/past/:id', async (req, res) => {
	try {
		const past = await TrainingSession.find({student: req.params.id}).populate('instructor', 'fname lname cid').lean();
		res.stdRes.data = past;
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.post('/request/new', async (req, res) => {
	try {
		await TrainingRequest.create({
			student: req.body.submitter,
			startTime: req.body.startTime,
			endTime: req.body.endTime,
			milestone: req.body.milestone,
			remarks: req.body.remarks,
		});
		const student = await User.findById(req.body.submitter).select('fname lname').lean();

		transporter.sendMail({
			to: 'instructors@zabartcc.org',
			subject: 'New Training Request | Albuquerque ARTCC',
			template: 'newRequest',
			context: {
				student: student.fname + ' ' + student.lname,
				startTime: new Date(req.body.startTime).toLocaleString('en-US', {month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}),
				endTime: new Date(req.body.endTime).toLocaleString('en-US', {month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'})
			}
		});
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.get('/milestones/:id', async (req, res) => {
	try {
		const user = await User.findOne({_id: req.params.id}).select('trainingMilestones rating').populate('trainingMilestones', 'code name rating').lean();
		const milestones = await TrainingMilestone.find({}).lean();

		res.stdRes.data = {
			user,
			milestones
		};
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.get('/request/open', async (req, res) => {
	try {
		const days = req.query.period; // days from start of CURRENT week
		const d = new Date(Date.now()),
			currentDay = d.getDay(),
			diff = d.getDate() - currentDay,
			startOfWeek = d.setDate(diff);

		const requests = await TrainingRequest.find({
			startTime: {
				$gte: ((new Date(startOfWeek)).toDateString()),
				$lte: ((new Date(startOfWeek + (days * 1000 * 60 * 60 * 24))).toDateString())
			},
			instructor: null,
			deleted: false
		}).select('startTime').lean();

		res.stdRes.data = requests;
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.post('/request/take/:id', async (req, res) => {
	try {
		console.log(req.body);

		const request = await TrainingRequest.findByIdAndUpdate(req.params.id, {
			instructor: req.body.instructor
		}).lean();

		await TrainingSession.create({
			student: request.student,
			instructor: req.body.instructor,
			startTime: req.body.startTime,
			endTime: req.body.endTime,
			milestone: request.milestone,
			submitted: false
		});
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.get('/request/:date', async (req, res) => {
	try {
		const d = new Date(`${req.params.date.slice(0,4)}-${req.params.date.slice(4,6)}-${req.params.date.slice(6,8)}`);
		const dayAfter = new Date(d);
		dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);

		const requests = await TrainingRequest.find({
			startTime: {
				$gte: (d.toISOString()),
				$lte: (dayAfter.toISOString())
			}
		}).populate('student', 'fname lname rating vis').populate('milestone', 'name code').lean();

		res.stdRes.data = requests;
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.get('/session/open/:id', async (req, res) => {
	try {
		const sessions = await TrainingSession.find({
			instructor: req.params.id,
			$or: [
				{submitted: false},
				{synced: false}
			]
		}).populate('student', 'fname lname cid vis').populate('milestone', 'name code').lean();

		res.stdRes.data = sessions;
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

export default router;