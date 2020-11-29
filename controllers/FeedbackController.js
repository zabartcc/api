import express from 'express';
const router = express.Router();
import Feedback from '../models/Feedback.js';
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

router.get('/unapproved', isMgt, async ({res}) => {
	const feedback = await Feedback.find({deletedAt: null, approved: false}).lean();
	return res.json(feedback);
});


export default router;