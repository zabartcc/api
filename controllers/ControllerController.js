import e from 'express';
const router = e.Router();
import User from '../models/User.js';
import ControllerHours from '../models/ControllerHours.js';
import Role from '../models/Role.js';
import VisitApplication from '../models/VisitApplication.js';
import Absence from '../models/Absence.js';
import Notification from '../models/Notification.js';
import transporter from '../config/mailer.js';
import getUser from '../middleware/getUser.js';
import auth from '../middleware/auth.js';
import microAuth from '../middleware/microAuth.js';
import axios from 'axios';

router.get('/', async ({res}) => {
	try {
		const home = await User.find({vis: false}).select('-email -idsToken').sort({
			rating: 'desc',
			lname: 'asc',
			fname: 'asc'
		}).populate({
			path: 'certifications',
			options: {
				sort: {order: 'desc'}
			}
		}).populate({
			path: 'roles',
			options: {
				sort: {order: 'asc'}
			}
		}).populate({
			path: 'absence',
			match: {
				expirationDate: {
					$gte: new Date()
				},
				deleted: false
			},
			select: '-reason'
		}).lean({virtuals: true});
	
		const visiting = await User.find({vis: true}).select('-email -idsToken').sort({
			rating: 'desc',
			lname: 'asc',
			fname: 'asc'
		}).populate({
			path: 'certifications',
			options: {
				sort: {order: 'desc'}
			}
		}).populate({
			path: 'roles',
			options: {
				sort: {order: 'asc'}
			}
		}).lean({virtuals: true});
	
		if(!home || !visiting) {
			throw {
				code: 503,
				message: "Unable to retrieve controllers."
			};
		}

		res.stdRes.data = {home, visiting};
	}
	catch(e) {
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
});

router.get('/staff', async (req, res) => {
	try {
		const users = await User.find().select('fname lname cid roleCodes').sort({
			lname: 'asc',
			fname: 'asc'
		})/*.populate({
			path: 'roles',
			options: {
				sort: {order: 'asc'}
			}
		})*/.lean();

		if(!users) {
			throw {
				code: 503,
				message: "Unable to retrieve staff members."
			};
		}

		const staff = {
			atm: {
				title: "Air Traffic Manager",
				code: "atm",
				users: []
			},
			datm: {
				title: "Deputy Air Traffic Manager",
				code: "datm",
				users: []
			},
			ta: {
				title: "Training Administrator",
				code: "ta",
				users: []
			},
			ec: {
				title: "Events Coordinator",
				code: "ec",
				users: []
			},
			wm: {
				title: "Web Team",
				code: "wm",
				users: []
			},
			fe: {
				title: "Facility Engineer",
				code: "fe",
				users: []
			},
			ins: {
				title: "Instructors",
				code: "instructors",
				users: []
			},
			mtr: {
				title: "Mentors",
				code: "instructors",
				users: []
			},
		};
		users.forEach(user => user.roleCodes.forEach(role => staff[role].users.push(user)));

		res.stdRes.data = staff;
	}
	catch(e) {
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
});

router.get('/role', async (req, res) => {
	try {
		const roles = await Role.find().lean();
		res.stdRes.data = roles;
	}
	catch(e) {
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
});

router.get('/oi', async (req, res) => {
	try {
		const oi = await User.find({deletedAt: null, member: true}).select('oi').lean();
		
		if(!oi) {
			throw {
				code: 503,
				message: "Unable to retrieve operating initials."
			};
		}

		res.stdRes.data = oi.map(oi => oi.oi);
	}
	catch(e) {
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
});

router.get('/visit', getUser, auth(['atm', 'datm']), async ({res}) => {
	try {
		const applications = await VisitApplication.find({deletedAt: null, acceptedAt: null}).lean();
		res.stdRes.data = applications;
	} catch(e) {
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);	
});

router.get('/absence', getUser, auth(['atm', 'datm']), async(req, res) => {
	try {
		const absences = await Absence.find({
			expirationDate: {
				$gte: new Date()
			},
			deleted: false
		}).populate(
			'user', 'fname lname cid'
		).lean();

		res.stdRes.data = absences;
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.post('/absence', getUser, auth(['atm', 'datm']), async(req, res) => {
	try {
		if(!req.body || req.body.controller === '' || req.body.expirationDate === '' || req.body.reason === '') {
			throw {
				code: 400,
				message: 'You must fill out all required fields'
			}
		} 

		if(new Date(req.body.expirationDate) < new Date()) {
			throw {
				code: 400,
				message: 'Expiration date must be in the future'
			}
		}

		await Absence.create(req.body);

		await Notification.create({
			recipient: req.body.controller,
			title: 'Leave of Absence granted',
			read: false,
			content: `You have been granted Leave of Absence until <b>${new Date(req.body.expirationDate).toLocaleString('en-US', {
				month: 'long', 
				day: 'numeric',
				year: 'numeric', 
				timeZone: 'UTC',
			})}</b>.`
		});

		await req.app.dossier.create({
			by: res.user.cid,
			affected: req.body.controller,
			action: `%b added a leave of absence for %a: ${req.body.reason}`
		});

	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.delete('/absence/:id', getUser, auth(['atm', 'datm']), async(req, res) => {
	try {
		if(!req.params.id) {
			throw {
				code: 401,
				message: "Invalid request"
			}
		}

		const absence = await Absence.findOne({_id: req.params.id});
		await absence.delete();

		await req.app.dossier.create({
			by: res.user.cid,
			affected: absence.controller,
			action: `%b deleted the leave of absence for %a.`
		});
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.get('/log', getUser, auth(['atm', 'datm', 'ta', 'fe', 'ec', 'wm']), async (req, res) => {
	try {
		const dossier = await req.app.dossier.find().sort({createdAt: 'desc'}).populate('userBy', 'fname lname cid').populate('userAffected', 'fname lname cid').lean();
		res.stdRes.data = dossier;
	}
	catch(e) {
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
})

router.get('/:cid', getUser, async (req, res) => {
	try {
		const user = await User.findOne({
			cid: req.params.cid
		}).select(
			'-idsToken'
		).populate('roles').populate('certifications').populate({
			path: 'absence',
			match: {
				expirationDate: {
					$gte: new Date()
				},
				deleted: false
			},
			select: '-reason'
		}).lean({virtuals: true});

		if(!user) {
			throw {
				code: 503,
				message: "Unable to find controller."
			};
		}

		if(!res.user || !res.user.isStaff) {
			delete user.email;
		}

		res.stdRes.data = user;
	}
	catch(e) {
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
});

router.get('/stats/:cid', async (req, res) => {
	try {
		const controllerHours = await ControllerHours.find({cid: req.params.cid});
		const hours = {
			gtyear: {
				del: 0,
				gnd: 0,
				twr: 0,
				app: 0,
				ctr: 0
			}, 
			total: {
				del: 0,
				gnd: 0,
				twr: 0,
				app: 0,
				ctr: 0
			},
			sessionCount: controllerHours.length,
			sessionAvg: 0,
			months: [],
		};
		const pos = {
			del: 'del',
			gnd: 'gnd',
			twr: 'twr',
			dep: 'app',
			app: 'app',
			ctr: 'ctr'
		}
		const today = new Date();
	
		const getMonthYearString = date => date.toLocaleString('en-US', {month: 'short', year: 'numeric'});
	
		for(let i = 0; i < 12; i++) {
			const theMonth = new Date;
			theMonth.setMonth(today.getMonth() - i);
			hours[getMonthYearString(theMonth)] = {
				del: 0,
				gnd: 0,
				twr: 0,
				app: 0,
				ctr: 0
			};
			hours.months.push(getMonthYearString(theMonth));
		}
	
		for(const sess of controllerHours) {
			const thePos = sess.position.toLowerCase().match(/([a-z]{3})$/); // 🤮

			if(thePos) {
				const start = new Date(sess.timeStart);
				const end = new Date(sess.timeEnd);
				const type = pos[thePos[1]];
				const length = Math.floor(end.getTime()/1000) - Math.floor(start.getTime()/1000);
				let ms = getMonthYearString(start);
	
				if(!hours[ms]) {
					ms = 'gtyear';
				}
	
				hours[ms][type] += length;
				hours.total[type] += length;
			}
	
		}

		hours.sessionAvg = Math.round(Object.values(hours.total).reduce((acc, cv) => acc + cv)/hours.sessionCount);
		res.stdRes.data = hours;
	}

	catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.post('/visit', getUser, async (req, res) => {
	try {
		if(!res.user) {
			throw {
				code: 401,
				message: "Unable to verify user."
			};
		}

		const data = {
			cid: res.user.cid,
			fname: res.user.fname,
			lname: res.user.lname,
			rating: res.user.ratingLong,
			email: res.user.email,
			home: req.body.home,
			reason: req.body.reason
		};

		await VisitApplication.create(data);
		
		await transporter.sendMail({
			to: req.body.email,
			subject: `Visiting Application Received | Albuquerque ARTCC`,
			template: 'visitReceived',
			context: {
				name: `${ req.body.fname} ${ req.body.lname}`,
			}
		});
		await transporter.sendMail({
			to: 'atm@zabartcc.org; datm@zabartcc.org',
			subject: `New Visiting Application: ${req.body.fname} ${req.body.lname} | Albuquerque ARTCC`,
			template: 'staffNewVisit',
			context: {
				user: data
			}
		});
	}
	catch(e) {
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);	
});

router.put('/visit/:cid', getUser, auth(['atm', 'datm']), async (req, res) => {
	try {
		await VisitApplication.delete({cid: req.params.cid});

		const user = await User.findOneAndUpdate({cid: req.params.cid}, {member: true, vis: true});

		await transporter.sendMail({
			to: user.email,
			subject: `Visiting Application Accepted | Albuquerque ARTCC`,
			template: 'visitAccepted',
			context: {
				name: `${user.fname} ${user.lname}`,
			}
		});

		await req.app.dossier.create({
			by: res.user.cid,
			affected: user.cid,
			action: `%b approved the visiting application for %a.`
		});
	} 
	catch(e) {
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
});


router.delete('/visit/:cid', getUser, auth(['atm', 'datm']), async (req, res) => {
	try {
		await VisitApplication.delete({cid: req.params.cid});

		const user = await User.findOne({cid: req.params.cid});

		await transporter.sendMail({
			to: user.email,
			subject: `Visiting Application Rejected | Albuquerque ARTCC`,
			template: 'visitRejected',
			context: {
				name: `${user.fname} ${user.lname}`,
				reason: req.body.reason
			}
		});
		await req.app.dossier.create({
			by: res.user.cid,
			affected: user.cid,
			action: `%b rejected the visiting application for %a: ${req.body.reason}`
		});
	} 
	catch(e) {
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
});

router.post('/:cid', microAuth, async (req, res) => {
	try {
		const user = await User.findOne({cid: req.params.cid});
		if(user) {
			throw {
				code: 409,
				message: "This user already exists"
			};
		}
		
		if(!req.body) {
			throw {
				code: 400,
				message: "No user data provided"
			};
		}

		const oi = await User.find({deletedAt: null, member: true}).select('oi').lean();
		const userOi = generateOperatingInitials(req.body.fname, req.body.lname, oi.map(oi => oi.oi))
		const {data} = await axios.get(`https://ui-avatars.com/api/?name=${userOi}&size=256&background=122049&color=ffffff`, {responseType: 'arraybuffer'});

		await req.app.s3.putObject({
			Bucket: 'zabartcc/avatars',
			Key: `${req.body.cid}-default.png`,
			Body: data,
			ContentType: 'image/png',
			ACL: 'public-read',
			ContentDisposition: 'inline',
		}).promise();

		await User.create({
			...req.body,
			oi: userOi,
			avatar: `${req.body.cid}-default.png`,
		});

		
		await req.app.dossier.create({
			by: -1,
			affected: req.body.cid,
			action: `%a was created by an external service.`
		});
	}
	catch(e) {
		res.stdRes.ret_det = e;
	}
		
	return res.json(res.stdRes);
});

router.put('/:cid/member', microAuth, async (req, res) => {
	try {
		const user = await User.findOne({cid: req.params.cid});

		if(!user) {
			throw {
				code: 400,
				message: "Unable to find user."
			};
		}

		const oi = await User.find({deletedAt: null, member: true}).select('oi').lean();

		user.member = req.body.member,
		user.oi = (req.body.member) ? generateOperatingInitials(user.fname, user.lname, oi.map(oi => oi.oi)) : null

		await user.save();

		
		await req.app.dossier.create({
			by: -1,
			affected: req.params.cid,
			action: `%a was ${req.body.member ? 'added to' : 'removed from'} the roster by an external service.`
		});
	}
	catch(e) {
		res.stdRes.ret_det = e;
	}
		
	return res.json(res.stdRes);
})

router.put('/:cid/visit', microAuth, async (req, res) => {
	try {
		const user = await User.findOne({cid: req.params.cid});

		if(!user) {
			throw {
				code: 400,
				message: "Unable to find user."
			};
		}

		user.vis = req.body.vis,

		await user.save();

		await req.app.dossier.create({
			by: -1,
			affected: req.params.cid,
			action: `%a was set as a ${req.body.vis ? 'visiting controller' : 'home controller'} by an external service.`
		});
	}
	catch(e) {
		res.stdRes.ret_det = e;
	}
		
	return res.json(res.stdRes);
})

router.put('/:cid', getUser, auth(['atm', 'datm', 'ta', 'fe', 'ec', 'wm', 'ins', 'mtr']), async (req, res) => {
	try {
		if(!req.body.form) {
			throw {
				code: 400,
				message: "No user data included."
			};
		}
		
		const {fname, lname, email, oi, roles, certs, vis} = req.body.form;
		const toApply = {
			roles: [],
			certifications: []
		};

		for(const [code, set] of Object.entries(roles)) {
			if(set) {
				toApply.roles.push(code);
			}
		}

		for(const [code, set] of Object.entries(certs)) {
			if(set) {
				toApply.certifications.push(code);
			}
		}

		const {data} = await axios.get(`https://ui-avatars.com/api/?name=${oi}&size=256&background=122049&color=ffffff`, {responseType: 'arraybuffer'});

		await req.app.s3.putObject({
			Bucket: 'zabartcc/avatars',
			Key: `${req.params.cid}-default.png`,
			Body: data,
			ContentType: 'image/png',
			ACL: 'public-read',
			ContentDisposition: 'inline',
		}).promise();

		await User.findOneAndUpdate({cid: req.params.cid}, {
			fname,
			lname, 
			email,
			oi,
			vis,
			roleCodes: toApply.roles,
			certCodes: toApply.certifications,
		});

		await req.app.dossier.create({
			by: res.user.cid,
			affected: req.params.cid,
			action: `%a was updated by %b.`
		});
	}
	catch(e) {
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
});

router.delete('/:cid', getUser, auth(['atm', 'datm']), async (req, res) => {
	try {
		await User.findOneAndUpdate({cid: req.params.cid}, {
			member: false
		});

		await req.app.dossier.create({
			by: res.user.cid,
			affected: req.params.cid,
			action: `%a was removed from the roster by %b.`
		});
	}
	catch(e) {
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
});

/**
 * Generates a pair of operating initials for a new controller.
 * @param fname User's first name.
 * @param lname User's last name.
 * @param usedOi Array of currently used OI
 * @return A two character set of operating initials (e.g. RA).
 */
const generateOperatingInitials = (fname, lname, usedOi) => {
	let operatingInitials;
	const MAX_TRIES = 10;

	operatingInitials = `${fname.charAt(0).toUpperCase()}${lname.charAt(0).toUpperCase()}`;
	
	if(!usedOi.includes(operatingInitials)) {
		return operatingInitials;
	}
	
	operatingInitials = `${lname.charAt(0).toUpperCase()}${fname.charAt(0).toUpperCase()}`;
	
	if(!usedOi.includes(operatingInitials)) {
		return operatingInitials;
	}

	const chars = `${lname.toUpperCase()}${fname.toUpperCase()}`;

	let tries = 0;

	do {
		operatingInitials = random(chars, 2);
		tries++;
	} while(usedOi.includes(operatingInitials) || tries > MAX_TRIES);

	if(!usedOi.includes(operatingInitials)) {
		return operatingInitials;
	}

	tries = 0;

	do {
		operatingInitials = random('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 2);
		tries++;
	} while(usedOi.includes(operatingInitials) || tries > MAX_TRIES);

	if(!usedOi.includes(operatingInitials)) {
		return operatingInitials;
	}

	return false;
};

/**
 * Selects a number of random characters from a given string.
 * @param str String of characters to select from.
 * @param len Number of characters to select.
 * @return String of selected characters.
 */
const random = (str, len) => {
	let ret = '';
	for (let i = 0; i < len; i++) {
		ret = `${ret}${str.charAt(Math.floor(Math.random() * str.length))}`;
	}
	return ret;
};

export default router;