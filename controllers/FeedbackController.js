import express from 'express';
const router = express.Router();
import Feedback from '../models/Feedback.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import getUser from '../middleware/getUser.js';
import auth from '../middleware/auth.js';

router.get('/', getUser, auth(['atm', 'datm', 'ta', 'ec']), async (req, res) => { // All feedback
	try {
		const page = +req.query.page || 1;
		const limit = +req.query.limit || 20;

		const amount = await Feedback.countDocuments({$or: [{approved: true}, {deleted: true}]});
		const feedback = await Feedback.find({
			$or: [{approved: true}, {deleted: true}]
		}).skip(limit * (page - 1))
		.limit(limit)
		.sort({createdAt: 'desc'})
		.populate('controller', 'fname lname cid')
		.lean();

		res.stdRes.data = {
			amount,
			feedback
		};
	} catch (e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
});

router.post('/', async (req, res) => { // Submit feedback
	try {
		if(req.body.name === '' || req.body.email === '' || req.body.cid === null || req.body.controller === null || req.body.rating === null || req.body.position === null || req.body.comments === '') { // Validation
			throw {
				code: 400,
				message: "You must fill out all required forms"
			};
		}

		if(req.body.comments && req.body.comments.length > 5000) {
			throw {
				code: 400,
				message: "Comments must not exceed 5000 characters in length"
			}
		}

		await Feedback.create({
			name: req.body.name,
			email: req.body.email,
			submitter: req.body.cid,
			controllerCid: req.body.controller,
			rating: req.body.rating,
			position: req.body.position,
			comments: req.body.comments,
			anonymous: req.body.anon,
			approved: false
		});

		await req.app.dossier.create({
			by: req.body.cid,
			affected: req.body.controller,
			action: `%b submitted feeback about %a.`
		});
	} catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
});

router.get('/controllers', async ({res}) => { // Controller list on feedback page
	try {
		const controllers = await User.find({deletedAt: null, member: true}).sort('fname').select('fname lname cid rating vis _id').lean();
		res.stdRes.data = controllers;
	} catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.get('/unapproved', getUser, auth(['atm', 'datm', 'ta', 'ec']), async ({res}) => { // Get all unapproved feedback
	try {
		const feedback = await Feedback.find({deletedAt: null, approved: false}).populate('controller', 'fname lname cid').sort({createdAt: 'desc'}).lean();
		res.stdRes.data = feedback;
	} catch (e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}
	return res.json(res.stdRes);
});

router.put('/approve/:id', getUser, auth(['atm', 'datm', 'ta']), async (req, res) => { // Approve feedback
	try {
		const approved = await Feedback.findOneAndUpdate({_id: req.params.id}, {
			approved: true
		}).populate('controller', 'cid');
	
		await Notification.create({
			recipient: approved.controller.cid,
			read: false,
			title: 'New Feedback Received',
			content: `You have received new feedback from ${approved.anonymous ? '<b>Anonymous</b>' : '<b>' + approved.name + '</b>'}.`,
			link: '/dash/feedback'
		});

		await req.app.dossier.create({
			by: res.user.cid,
			affected: approved.controllerCid,
			action: `%b approved feedback for %a.`
		});
	} catch (e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.put('/reject/:id', getUser, auth(['atm', 'datm', 'ta']), async (req, res) => { // Reject feedback
	try {
		const feedback = await Feedback.findOne({_id: req.params.id});
		await feedback.delete();
		await req.app.dossier.create({
			by: res.user.cid,
			affected: feedback.controllerCid,
			action: `%b rejected feedback for %a.`
		});
	} catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.get('/own', getUser, async (req, res) => {
	try {
		const page = +req.query.page || 1;
		const limit = +req.query.limit || 10;

		const amount = await Feedback.countDocuments({approved: true, controllerCid: res.user.cid});
		const feedback = await Feedback.aggregate([
			{$match: { 
				controllerCid: res.user.cid,
				approved: true
			}},
			{$project: {
				controller: 1,
				position: 1,
				rating: 1,
				comments: 1,
				createdAt: 1,
				anonymous: 1,
				name: { $cond: [ "$anonymous", "$$REMOVE", "$name"]} // Conditionally remove name if submitter wishes to remain anonymous
			}},
			{$sort: { "createdAt": -1}},
			{$skip: limit * (page - 1)},
			{$limit: limit},
		]);

		res.stdRes.data = {
			feedback,
			amount
		};
	} catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});


export default router;