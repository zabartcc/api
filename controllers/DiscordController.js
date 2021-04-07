import express from 'express';
import microAuth from '../middleware/microAuth.js';
const router = express.Router();

import User from '../models/User.js';

router.get('/users', microAuth, async (req, res) => {
	try {
		const users = await User.find({discordInfo: {$ne: null}})
			.select('fname lname cid discordInfo roleCodes oi rating member vis');

		res.stdRes.data = users;
	}
	catch(e) {
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
})

export default router;