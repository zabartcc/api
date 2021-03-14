import express from 'express';
const router = express.Router();
import transporter from '../config/mailer.js';
import TrainingSession from '../models/TrainingSession.js';
import TrainingRequest from '../models/TrainingRequest.js';
import TrainingMilestone from '../models/TrainingMilestone.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import getUser from '../middleware/getUser.js';
import {isIns} from '../middleware/isStaff.js';

router.get('/request/upcoming/:id', getUser, async (req, res) => {
	try {
		const upcoming = await TrainingRequest.find({
			student: res.user._id, 
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

router.post('/request/new', getUser, async (req, res) => {
	try {
		if(!req.body.submitter || !req.body.startTime || !req.body.endTime || !req.body.milestone || req.body.remarks.length > 500) {
			throw {
				code: 400,
				message: `You must fill out all required forms`
			};
		}

		await TrainingRequest.create({
			student: res.user._id,
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

router.get('/milestones', getUser, async (req, res) => {
	try {
		const user = await User.findOne({cid: res.user.cid}).select('trainingMilestones rating').populate('trainingMilestones', 'code name rating').lean();
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

router.get('/request/open', isIns, async (req, res) => {
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

router.post('/request/take/:id', isIns, async (req, res) => {
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

router.get('/request/:date', isIns, async (req, res) => {
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

router.get('/session/open/:id', isIns, async (req, res) => {
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

router.get('/session/:id', async(req, res) => {
	try {
		const session = await TrainingSession.findById(
			req.params.id
		).populate(
			'student', 'fname lname cid vis'
		).populate(
			'instructor', 'fname lname'
		).populate(
			'milestone', 'name code'
		).lean();

		res.stdRes.data = session;
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.get('/sessions', isIns, async(req, res) => {
	try {
		const page = parseInt(req.query.page, 10);
		const limit = parseInt(req.query.limit, 10);

		const amount = await TrainingSession.countDocuments({submitted: true, deleted: false});
		const sessions = await TrainingSession.find({
			deleted: false, submitted: true
		}).skip(limit * (page - 1)).limit(limit).sort({
			createdAt: 'desc'
		}).populate(
			'student', 'fname lname cid vis'
		).populate(
			'instructor', 'fname lname'
		).populate(
			'milestone', 'name code'
		).lean();

		res.stdRes.data = {
			count: amount,
			sessions: sessions
		};
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.get('/sessions/past', getUser, async (req, res) => {
	try {
		const page = parseInt(req.query.page, 10);
		const limit = parseInt(req.query.limit, 10);

		const amount = await TrainingSession.countDocuments({student: res.user._id, deleted: false, submitted: true});
		const sessions = await TrainingSession.find({
			student: res.user._id, deleted: false, submitted: true
		}).skip(limit * (page - 1)).limit(limit).sort({
			createdAt: 'desc'
		}).populate(
			'instructor', 'fname lname cid'
		).populate(
			'student', 'fname lname'
		).populate(
			'milestone', 'name code'
		).lean();
		res.stdRes.data = {
			count: amount,
			sessions: sessions
		};
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.put('/session/save/:id', isIns, async(req, res) => {
	try {
		await TrainingSession.findOneAndUpdate(req.params.id, req.body);
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.put('/session/submit/:id', isIns, async(req, res) => {
	try {
		if(req.body.position === '' || req.body.progress === null || req.body.movements === null || req.body.location === null || req.body.ots === null || req.body.studentNotes === null || req.body.studentNotes.length > 3000 || req.body.insNotes.length > 3000) {
			throw {
				code: 400,
				message: 'Please fill out all required fields'
			};
		}

		const delta = Math.abs(new Date(req.body.endTime) - new Date(req.body.startTime)) / 1000;
		console.log(new Date(req.body.endTime));
		const hours = Math.floor(delta / 3600);
		const minutes = Math.floor(delta / 60) % 60;

		const duration = `${('00' + hours).slice(-2)}:${('00' + minutes).slice(-2)}`;

		const session = await TrainingSession.findOneAndUpdate(req.params.id, {
			position: req.body.position,
			progress: req.body.progress,
			duration: duration,
			movements: req.body.movements,
			location: req.body.location,
			ots: req.body.ots,
			studentNotes: req.body.studentNotes,
			insNotes: req.body.insNotes,
			submitted: true
		});

		const instructor = await User.findById(session.instructor).select('fname lname').lean();

		await Notification.create({
			recipient: session.student,
			read: false,
			title: 'Training Notes Submitted',
			content: `The training notes from your session with <b>${instructor.fname + ' ' + instructor.lname}</b> have been submitted.`,
			link: '/dash/training'
		});
	} catch(e) {
		console.log(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

export default router;