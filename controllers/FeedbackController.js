import express from 'express';
const router = express.Router();
import Feedback from '../models/Feedback.js';
import m from 'mongoose';
import transporter from '../config/mailer.js';
import User from '../models/User.js';
import {isMgt} from '../middleware/isStaff.js';

router.get('/', isMgt, async (req, res) => { // All feedback
	const page = parseInt(req.query.page, 10);
	const limit = parseInt(req.query.limit, 10);

	const count = await Feedback.estimatedDocumentCount();
	const feedback = await Feedback.find().skip(limit * (page - 1)).limit(limit).sort({createdAt: 'desc'}).populate('controller', 'fname lname cid').lean();
	return res.json({
		feedback: feedback,
		amount: count
	});
});

router.post('/', async (req, res) => { // Submit feedback
	if(req.body.fname === '' || req.body.lname === '' || req.body.cid === '' || req.body.comments.length > 5000) { // Validation
		return res.status(500).send('All form entries must be valid.');
	} else {
		Feedback.create({
			fname: req.body.fname,
			lname: req.body.lname,
			email: req.body.email,
			submitter: req.body.cid,
			controller: m.Types.ObjectId(req.body.controller),
			rating: req.body.rating,
			comments: req.body.comments,
			anonymous: req.body.anon,
			approved: false
		}).then(async () => {
			return res.sendStatus(200);
		}).catch((err) => {
			console.log(err);
			return res.status(500).send(err);
		});
	}
});

router.get('/controllers', async ({res}) => { // Controller list on feedback page
	const controllers = await User.find({deletedAt: null}).sort('fname').select('fname lname _id').lean();
	return res.json(controllers);
});

router.get('/unapproved', isMgt, async ({res}) => { // Unapproved feedback
	const feedback = await Feedback.find({deletedAt: null, approved: false}).populate('controller', 'fname lname cid').lean();
	return res.json(feedback);
});

router.put('/approve/:id', isMgt, async (req, res) => { // Approve feedback
	try {
		const approved = await Feedback.findOneAndUpdate({_id: req.params.id}, {
			approved: true
		}).populate('controller', 'email fname lname');
		transporter.sendMail({
			to: approved.controller.email,
			subject: `You have received new feedback | Albuquerque ARTCC`,
			template: 'newFeedback',
			context: {
				name: `${approved.controller.fname} ${approved.controller.lname}`,
			}
		});
		return res.sendStatus(200);
	} catch (err) {
		console.log(err);
		return res.sendStatus(500);
	}
});

router.put('/reject/:id', isMgt, async (req, res) => { // Reject feedback
	Feedback.delete({_id: req.params.id}, (err) => {
		if(err) {
			console.log(err);
			return res.sendStatus(500);
		} else {
			return res.sendStatus(200);
		}
	});
});

export default router;