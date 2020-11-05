import e from 'express';
const router = e.Router();

import User from '../models/User.js';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios';

dotenv.config();

router.get('/', (req, res) => {
	const userToken = req.headers.authorization.split(' ')[1];
	if(!userToken) {
		res.sendStatus(401);
	} else {
		jwt.verify(userToken, process.env.JWT_SECRET, async (err, decoded) => {
			if(err) {
				console.log(`Unable to verify token: ${err}`);
				res.sendStatus(401);
			} else {
				const user = await User.findOne({
					cid: decoded.cid
				}).populate('roles');

				res.json(user);
			}
		});
	}
});

router.post('/login', async (req, res) => {
	const ulsJWK = JSON.parse(process.env.VATUSA_ULS_JWK);
	const loginTokenParts = req.body.token.split('.');

	const sig = Buffer.from(
		crypto.createHmac('sha256', new Buffer.from(ulsJWK.k, 'base64'))
			.update(`${loginTokenParts[0]}.${loginTokenParts[1]}`)
			.digest()
	).toString('base64').replace(/\+/g, "-").replace(/\//g, '_').replace(/=+$/g, '');

	if(sig === loginTokenParts[2]) {
		const loginTokenData = JSON.parse(Buffer.from(loginTokenParts[1], 'base64'));
		if(loginTokenData.iss !== 'VATUSA') return res.sendStatus(500);
		if(loginTokenData.aud !== 'ZAB') return res.sendStatus(500);

		const { data: userData } = await axios.get(`https://login.vatusa.net/uls/v2/info?token=${loginTokenParts[1]}`);

		
		if(!userData) return res.sendStatus(500);

		const user = User.findOne({cid: userData.cid});

		if(!user) return res.sendStatus(401);

		if(!user.email) {
			await User.findOneAndUpdate({cid: userData.cid}, {email: userData.email});
		}

		const apiToken = jwt.sign({cid: userData.cid}, process.env.JWT_SECRET, {expiresIn: '30d'});
		
		return res.json(apiToken);

	} else {
		return res.sendStatus(500);
	}
});

export default router;