import express from 'express';
const router = express.Router();
import Feedback from '../models/Feedback.js';
import User from '../models/User.js';
import {isMgt} from '../middleware/isStaff.js';

router.post('/', async (req, res) => {
	if(req.body.fname === '' || req.body.lname === '' || req.body.cid === '' || req.body.comments.length > 5000) { // Validation
		return res.status(500).send('All form entries must be valid.');
	} else {
		Feedback.create({
			fname: req.body.fname,
			lname: req.body.lname,
			email: req.body.email,
			submitter: req.body.cid,
			controller: req.body.controller,
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

router.get('/controllers', async ({res}) => {
	const controllers = await User.find({deletedAt: null}).sort('fname').select('fname lname _id').lean();
	return res.json(controllers);
});

router.get('/unapproved', isMgt, async ({res}) => {
	const feedback = await Feedback.find({deletedAt: null, approved: false}).populate('controller', 'fname lname cid').lean();
	return res.json(feedback);
});

router.put('/approve/:id', isMgt, async (req, res) => {
	Feedback.findOneAndUpdate({_id: req.params.id}, {
		approved: true
	}).then(() => {
		return res.sendStatus(200);
	}).catch((err) => {
		console.log(err);
		return res.sendStatus(500);
	});
});

router.put('/reject/:id', isMgt, async (req, res) => {
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