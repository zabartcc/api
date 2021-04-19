import e from 'express';
const router = e.Router();

import User from '../models/User.js';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios';
import {v4} from 'uuid';
import getUser from '../middleware/getUser.js';
import Notification from '../models/Notification.js';

import Discord from 'discord-oauth2';

dotenv.config();

router.get('/', async (req, res) => {
	try {
		if(!req.cookies.token) {
			throw {
				code: 401,
				message: "Token cookie not found"
			};
		}

		await new Promise((resolve, reject) => {
			jwt.verify(req.cookies.token, process.env.JWT_SECRET, async (err, decoded) => {
				if(err) {
					res.cookie('token', '', {expires: new Date(0)});
					reject({
						code: 403,
						message: `Unable to verify token: ${err}`
					});
				} else {
					const user = await User.findOne({
						cid: decoded.cid
					}).select('-createdAt -updatedAt').populate('roles').catch(console.log);
					if(!user) {
						res.cookie('token', '', {expires: new Date(0)});
						reject({
							code: 401,
							message: "User not found"
						});
					} 
					res.stdRes.data = user;
				}
				resolve();
			}).catch(err => {
				throw err;
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
				message: "Not logged in"
			};
		}

		res.user.idsToken = v4();

		await res.user.save();

		await req.app.dossier.create({
			by: res.user.cid,
			affected: -1,
			action: `%b generated a new IDS Token.`
		});

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
				message: "Unable to verify signature from VATUSA"
			};
		}
		
		const loginTokenData = JSON.parse(Buffer.from(loginTokenParts[1], 'base64'));

		if(loginTokenData.iss !== 'VATUSA') {
			throw {
				code: 500, 
				message: "Token not issued by VATUSA"
			};
		}		
		if(loginTokenData.aud !== 'ZAB') {
			throw {
				code: 500, 
				message: "Token not issued for ZAB"
			};
		}

		const { data: userData } = await axios.get(`https://login.vatusa.net/uls/v2/info?token=${loginTokenParts[1]}`);

		if(!userData) {
			throw {
				code: 500,
				message: "Unable to retrieve user data from VATUSA"
			};
		}
		
		let user = await User.findOne({cid: userData.cid});

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
			});
		} else {
			if(!user.email) {
				user.email = userData.email;
			}
			user.fname = userData.fname;
			user.lname = userData.lname;
			user.rating = userData.rating;
		}

		if(user.oi && !user.avatar) {
			const {data} = await axios.get(`https://ui-avatars.com/api/?name=${user.oi}&size=256&background=122049&color=ffffff`, {responseType: 'arraybuffer'});

			await req.app.s3.putObject({
				Bucket: 'zabartcc/avatars',
				Key: `${user.cid}-default.png`,
				Body: data,
				ContentType: 'image/png',
				ACL: 'public-read',
				ContentDisposition: 'inline',
			}).promise();
			user.avatar = `${user.cid}-default.png`;
		}
		
		await user.save();
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
				message: "User not logged in"
			};
		}
		res.cookie('token', '', {expires: new Date(0)});
	}
	catch(e) {
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
});

router.get('/discord', getUser, async (req, res) => {
	try {
		res.stdRes.data = !!res.user.discordInfo.clientId;
	} catch(e) {
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
})

router.post('/discord', async (req, res) => {
	try {
		if(!req.body.code || !req.body.cid) {
			throw {
				code: 400,
				message: "Incomplete request"
			};
		}

		const {cid, code} = req.body;
		const user = await User.findOne({cid});

		if(!user) {
			throw {
				code: 401,
				message: "User not found"
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
				message: "Unable to authenticate with Discord"
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
				message: "Unable to retrieve Discord info"
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



		await req.app.dossier.create({
			by: user.cid,
			affected: -1,
			action: `%b connected their Discord.`
		});
	}
	catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.delete('/discord', getUser, async (req, res) => {
	try {
		res.user.discordInfo = undefined;
		await res.user.save();
	} catch(e) {
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
})

router.get('/notifications', getUser, async(req, res) => {
	try {
		const page = +req.query.page || 1;
		const limit = +req.query.limit || 10;

		const unread = await Notification.countDocuments({deleted: false, recipient: res.user.cid, read: false});
		const amount = await Notification.countDocuments({deleted: false, recipient: res.user.cid});
		const notif = await Notification.find({recipient: res.user.cid, deleted: false}).skip(limit * (page - 1)).limit(limit).sort({createdAt: "desc"}).lean();

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

router.put('/notifications/read/all', getUser, async(req, res) => {
	try {
		await Notification.updateMany({recipient: res.user.cid}, {
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
				message: "Incomplete request"
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

router.delete('/notifications', getUser, async(req, res) => {
	try {
		await Notification.delete({recipient: res.user.cid});
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.put('/profile', getUser, async (req, res) => {
	try {
		const { bio } = req.body;

		await User.findOneAndUpdate({cid: res.user.cid}, {
			bio
		});

		await req.app.dossier.create({
			by: res.user.cid,
			affected: -1,
			action: `%b updated their profile.`
		});

	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
})

export default router;