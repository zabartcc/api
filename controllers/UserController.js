import e from 'express';
const router = e.Router();

import User from '../models/User.js';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios';
import {v4} from 'uuid';
import getUser from '../middleware/getUser.js';
import {isSelf} from '../middleware/isSelf.js';
import Notification from '../models/Notification.js';
import m from 'mongoose';

import Discord from 'discord-oauth2';
import minio from 'minio';

dotenv.config();

const minioClient = new minio.Client({
	endPoint: 'cdn.zabartcc.org',
	port: 443,
	useSSL: true,
	accessKey: process.env.MINIO_ACCESS_KEY,
	secretKey: process.env.MINIO_SECRET_KEY
});

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
					res.cookie('token', '', {expires: new Date(0)});
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

router.post('/idsToken', getUser, async (req, res) => {
	try {
		if(!req.cookies.token) {
			throw {
				code: 401,
				message: "Not logged in."
			};
		}

		res.user.idsToken = v4();

		await res.user.save();

		res.stdRes.data = res.user.idsToken;
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
		
		let user;
		user = await User.findOne({cid: userData.cid});

		
		if(user.oi) {
			const {data} = await axios.get(`https://ui-avatars.com/api/?name=${user.oi}&size=512&background=122049&color=ffffff&format=png`, {
				responseType: 'arraybuffer'
			});

			await minioClient.putObject('avatars', `${user.cid}_default.png`, data).catch(console.log);
		}

		if(!user) {
			user = await User.create({
				cid: userData.cid,
				fname: userData.firstname,
				lname: userData.lastname,
				email: userData.email,
				rating: userData.intRating,
				oi: null,
				broadcast: false,
				member: false,
				vis: false,
				image: {
					custom: false,
					filename: `${userData.cid}_default.png`
				}
			});
		} else {
			if(!user.email) {
				await User.findOneAndUpdate({cid: userData.cid}, {email: userData.email});
			}
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

router.post('/discord', async (req, res) => {
	try {
		if(!req.body.code || !req.body.cid) {
			throw {
				code: 400,
				message: "Incomplete request."
			};
		}

		const {cid, code} = req.body;
		const user = await User.findOne({cid});

		if(!user) {
			throw {
				code: 401,
				message: "User not found."
			};
		}

		const oauth = new Discord();
		const token = await oauth.tokenRequest({
			clientId: process.env.DISCORD_CLIENT_ID,
			clientSecret: process.env.DISCORD_CLIENT_SECRET,
			redirectUri: process.env.DISCORD_REDIRECT_URI,
			grantType: 'authorization_code',
			code,
			scope: 'identify'

		}).catch(err => {
			console.log(err);
			return false;
		});

		if(!token) {
			throw {
				code: 403,
				message: "Unable to authenticate with Discord."
			};

		}

		const {data: discordUser} = await axios.get('https://discord.com/api/users/@me', {
			headers: {
				'Authorization': `${token.token_type} ${token.access_token}`,
				'User-Agent': 'Albuquerque ARTCC API'
			}
		}).catch(err => {
			console.log(err);
			return false;
		});

		if(!discordUser) {
			throw {
				code: 403,
				message: "Unable to retrieve Discord info."
			};

		}

		user.discordInfo.clientId = discordUser.id;
		user.discordInfo.accessToken = token.access_token;
		user.discordInfo.refreshToken = token.refresh_token;
		user.discordInfo.tokenType = token.token_type;

		let currentTime = new Date();
		currentTime = new Date(currentTime.getTime() + (token.expires_in*1000));
		user.discordInfo.expires = currentTime;

		await user.save();
	}
	catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.get('/notifications/:id', isSelf, async(req, res) => {
	try {
		if(!req.params.id) {
			throw {
				code: 400,
				message: "Incomplete request."
			};
		}
		const page = parseInt(req.query.page, 10);
		const limit = parseInt(req.query.limit, 10);

		const unread = await Notification.countDocuments({deleted: false, recipient: req.params.id, read: false});
		const amount = await Notification.countDocuments({deleted: false, recipient: req.params.id});
		const notif = await Notification.find({recipient: req.params.id, deleted: false}).skip(limit * (page - 1)).limit(limit).sort({createdAt: "desc"}).lean();

		res.stdRes.data = {
			unread,
			amount,
			notif
		};
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.put('/notifications/read/all/:id', async(req, res) => {
	try {
		if(!req.params.id) {
			throw {
				code: 400,
				message: "Incomplete request."
			};
		}
		await Notification.updateMany({recipient: req.params.id}, {
			read: true
		});
	} catch(e) {
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
});

router.put('/notifications/read/:id', async(req, res) => {
	try {
		if(!req.params.id) {
			throw {
				code: 400,
				message: "Incomplete request."
			};
		}
		await Notification.findByIdAndUpdate(req.params.id, {
			read: true
		});
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.delete('/notifications/:id', async(req, res) => {
	try {
		if(!req.params.id) {
			throw {
				code: 400,
				message: "Incomplete request."
			};
		}
		await Notification.delete({recipient: req.params.id});
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

export default router;