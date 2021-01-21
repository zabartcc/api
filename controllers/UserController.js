import e from 'express';
const router = e.Router();

import User from '../models/User.js';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios';

dotenv.config();

router.get('/', async (req, res) => {
	try {
		if(!req.cookies.token) {
			throw {
				code: 401,
				message: "Token cookie not found."
			};
		}

		await new Promise(resolve => {
			jwt.verify(req.cookies.token, process.env.JWT_SECRET, async (err, decoded) => {
				if(err) {
					throw {
						code: 403,
						message: `Unable to verify token: ${err}`
					};
				} else {
					const user = await User.findOne({
						cid: decoded.cid
					}).select('-email -createdAt -updatedAt').populate('roles');
					res.stdRes.data = user;
				}
				resolve();
			});
		});
		
	}
	catch(e) {
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
});

router.post('/login', async (req, res) => {
	const ulsJWK = JSON.parse(process.env.VATUSA_ULS_JWT);
	const loginTokenParts = req.body.token.split('.');

	const sig = Buffer.from(
		crypto.createHmac('sha256', new Buffer.from(ulsJWK.k, 'base64'))
			.update(`${loginTokenParts[0]}.${loginTokenParts[1]}`)
			.digest()
	).toString('base64').replace(/\+/g, "-").replace(/\//g, '_').replace(/=+$/g, '');

	try {
		if(sig !== loginTokenParts[2]) {
			throw {
				code: 500, 
				message: 'Unable to verify signature from VATUSA.'
			};
		}
		
		const loginTokenData = JSON.parse(Buffer.from(loginTokenParts[1], 'base64'));

		if(loginTokenData.iss !== 'VATUSA') {
			throw {
				code: 500, 
				message: 'Token not issued by VATUSA.'
			};
		}		
		if(loginTokenData.aud !== 'ZAB') {
			throw {
				code: 500, 
				message: 'Token not issued for ZAB.'
			};
		}

		const { data: userData } = await axios.get(`https://login.vatusa.net/uls/v2/info?token=${loginTokenParts[1]}`);

		if(!userData) {
			throw {
				code: 500,
				message: "Unable to retrieve user data from VATUSA."
			};
		}
		
		const user = await User.findOne({cid: userData.cid});

		if(!user) {
			throw {
				code: 403,
				message: "User not on roster."
			};
		}

		if(!user.email) {
			await User.findOneAndUpdate({cid: userData.cid}, {email: userData.email});
		}

		const apiToken = jwt.sign({cid: userData.cid}, process.env.JWT_SECRET, {expiresIn: '30d'});
		res.cookie('token', apiToken, { httpOnly: true, maxAge: 2592000000, sameSite: true}); // Expires in 30 days

	} 
	catch(e) {
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
});

router.get('/logout', async (req, res) => {
	try {
		if(!req.cookies.token) {
			throw {
				code: 400,
				message: "User not logged in."
			};
		}
		res.cookie('token', '', {expires: new Date(0)});
	}
	catch(e) {
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
});

router.get('/visit', async (req, res) => {
	if(!req.cookies.visToken) {
		return res.send('');
	} else {
		const visToken = req.cookies.visToken;
		jwt.verify(visToken, process.env.JWT_SECRET, async (err, decoded) => {
			if(err) {
				console.log(`Unable to verify token: ${err}`);
				return res.send(''); // In order to prevent console errors thrown from axios, return empty string.
			} else {
				return res.json(decoded);
			}
		});
	}
});

router.get('/visit/logout', async (req, res) => {
	if(!req.cookies.visToken) {
		return res.sendStatus(500);
	} else {
		res.cookie('visToken', '', {expires: new Date(0)});
		return res.sendStatus(200);
	}
});

router.post('/visit/login', async (req, res) => {
	const ulsJWK = JSON.parse(process.env.VATUSA_ULS_JWT);
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
		else {
			const token = jwt.sign({
				cid: userData.cid,
				fname: userData.firstname,
				lname: userData.lastname,
				email: userData.email,
				rating: userData.rating,
				facility: userData.facility.id || undefined
			}, process.env.JWT_SECRET, {expiresIn: '1d'});
			res.cookie('visToken', token, { httpOnly: true, maxAge: 86400000, secure: true, sameSite: true}); // Expires in one day
			return res.json(token);
		}
	} else {
		return res.sendStatus(500);
	}
});

export default router;