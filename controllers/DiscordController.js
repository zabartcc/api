import express from 'express';
import microAuth from '../middleware/microAuth.js';
const router = express.Router();

import User from '../models/User.js';
import Config from '../models/Config.js';

router.get('/users', microAuth, async (req, res) => {
	try {
		const users = await User.find({discordInfo: {$ne: null}})
			.select('fname lname cid discordInfo roleCodes oi rating member vis');

		res.stdRes.data = users;
	}
	catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
})

router.get('/withyou', microAuth, async (req, res) => {
	try {
		const withYou = await Config.findOne({}).select('withYou').lean();

		res.stdRes.data = withYou;
	}
	catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.post('/withyou', microAuth, async (req, res) => {
	try {
		const withYou = await Config.findOne({}).select('withYou');
		withYou.withYou++;
		await withYou.save();
	}
	catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.delete('/withyou', microAuth, async (req, res) => {
	try {
		const withYou = await Config.findOne({}).select('withYou');
		withYou.withYou--;
		await withYou.save();
	}
	catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});
	
export default router;