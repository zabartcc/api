import e from 'express';
import transporter from '../config/mailer.js';
import multer from 'multer';
import { fileTypeFromFile } from 'file-type';
import fs from 'fs/promises';
const router = e.Router();
import Event from '../models/Event.js';
import User from '../models/User.js';
import getUser from '../middleware/getUser.js';
import auth from '../middleware/auth.js';

const upload = multer({
	storage: multer.diskStorage({
		destination: (req, file, cb) => {
			cb(null, '/tmp');
		},
		filename: (req, file, cb) => {
			cb(null, `${Date.now()}-${file.originalname}`);
		}
	})
})

router.get('/', async ({res}) => {
	try {
		const events = await Event.find({
			eventEnd: {
				$gt: new Date(new Date().toUTCString()) // event starts in the future
			},
			deleted: false
		}).sort({eventStart: "asc"}).lean();

		res.stdRes.data = events;
	} catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.get('/archive', async(req, res) => {
	try {
		const page = +req.query.page || 1;
		const limit = +req.query.limit || 10;

		const count = await Event.countDocuments({
			eventEnd: {
				$lt: new Date(new Date().toUTCString())
			},
			deleted: false
		});
		const events = await Event.find({
			eventEnd: {
				$lt: new Date(new Date().toUTCString())
			},
			deleted: false
		}).skip(limit * (page - 1)).limit(limit).sort({eventStart: "desc"}).lean();

		res.stdRes.data = {
			amount: count,
			events: events
		};
	} catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.get('/:slug', async(req, res) => {
	try {
		const event = await Event.findOne({
			url: req.params.slug,
			deleted: false
		}).lean();

		res.stdRes.data = event;
	} catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.get('/:slug/positions', async(req, res) => {
	try {
		const event = await Event.findOne({
			url: req.params.slug,
			deleted: false
		}).sort({
			'positions.order': -1
		}).select(
			'open submitted eventStart positions signups name'
		).populate(
			'positions.user', 'cid fname lname roleCodes'
		).populate(
			'signups.user', 'fname lname cid vis rating certCodes'
		).lean({virtuals: true}).catch(console.error)

		res.stdRes.data = event;
	} catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.put('/:slug/signup', getUser, async (req, res) => {
	try {
		if(req.body.requests.length > 3) {
			throw {
				code: 400,
				message: "You may only give 3 preferred positions"
			}
		}

		if(res.user.member === false) {
			throw {
				code: 403,
				message: "You must be a member of ZAB"
			}
		}

		for(const r of req.body.requests) {
			if((/^([A-Z]{2,3})(_([A-Z]{1,3}))?_(DEL|GND|TWR|APP|DEP|CTR)$/.test(r) || r.toLowerCase() === "any") === false) {
				throw {
					code: 400,
					message: "Request must be a valid callsign or 'Any'"
				}
			}
		}

		const event = await Event.findOneAndUpdate({url: req.params.slug}, {
			$push: {
				signups: {
					cid: res.user.cid,
					requests: req.body.requests
				} 
			}
		});

		await req.app.dossier.create({
			by: res.user.cid,
			affected: -1,
			action: `%b signed up for the event *${event.name}*.`
		});
	} catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.delete('/:slug/signup', getUser, async (req, res) => {
	try {
		const event = await Event.findOneAndUpdate({url: req.params.slug}, {
			$pull: {
				signups: {
					cid: res.user.cid
				}
			}
		});

		await req.app.dossier.create({
			by: res.user.cid,
			affected: -1,
			action: `%b deleted their signup for the event *${event.name}*.`
		});
	} catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.delete('/:slug/mandelete/:cid', getUser, auth(['atm', 'datm', 'ec']), async(req, res) => {
	try {
		const signup = await Event.findOneAndUpdate({url: req.params.slug}, {
			$pull: {
				signups: {
					cid: req.params.cid
				}
			}
		});

		for(const position of signup.positions) {
			if(position.takenBy === res.user.cid) {
				await Event.findOneAndUpdate({url: req.params.slug, 'positions.takenBy': res.user.cid}, {
					$set: {
						'positions.$.takenBy': null
					}
				});
			}
		}

		await req.app.dossier.create({
			by: res.user.cid,
			affected: req.params.cid,
			action: `%b manually deleted the event signup for %a for the event *${signup.name}*.`
		});
	} catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.put('/:slug/mansignup/:cid', getUser, auth(['atm', 'datm', 'ec']), async (req, res) => {
	try {
		const user = await User.findOne({cid: req.params.cid});
		if(user !== null) {
			const event = await Event.findOneAndUpdate({url: req.params.slug}, {
				$push: {
					signups: {
						cid: req.params.cid,
					} 
				}
			});
			
			await req.app.dossier.create({
				by: res.user.cid,
				affected: req.params.cid,
				action: `%b manually signed up %a for the event *${event.name}*.`
			});
		} else {
			throw {
				code: 400,
				message: "Controller not found"
			};
		}
	} catch (e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.post('/', getUser, auth(['atm', 'datm', 'ec']), upload.single('banner'), async (req, res) => {
	try {
		const url = req.body.name.replace(/\s+/g, '-').toLowerCase().replace(/^-+|-+(?=-|$)/g, '').replace(/[^a-zA-Z0-9-_]/g, '') + '-' + Date.now().toString().slice(-5);
		const allowedTypes = ['image/jpg', 'image/jpeg', 'image/png', 'image/gif'];
		const fileType = await fileTypeFromFile(req.file.path);

		if(fileType === undefined || !allowedTypes.includes(fileType.mime)) {
			throw {
				code: 400,
				message: "Banner type not supported"
			}
		}
		if(req.file.size > (6 * 1024 * 1024)) {	// 6MiB
			throw {
				code: 400,
				message: "Banner too large"
			}
		}

		const tmpFile = await fs.readFile(req.file.path);
		
		await req.app.s3.putObject({
			Bucket: 'zabartcc/events',
			Key: req.file.filename,
			Body: tmpFile,
			ContentType: req.file.mimetype,
			ACL: 'public-read',
			ContentDisposition: 'inline',
		}).promise();

		await Event.create({
			name: req.body.name,
			description: req.body.description,
			url: url,
			bannerUrl: req.file.filename,
			eventStart: req.body.startTime,
			eventEnd: req.body.endTime,
			createdBy: res.user.cid,
			open: true,
			submitted: false
		});

		await req.app.dossier.create({
			by: res.user.cid,
			affected: -1,
			action: `%b created the event *${req.body.name}*.`
		});
	} catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}
	return res.json(res.stdRes);
});

router.put('/:slug', getUser, auth(['atm', 'datm', 'ec']), upload.single('banner'), async (req, res) => {
	try {
		const event = await Event.findOne({url: req.params.slug});
		const {name, description, startTime, endTime, positions} = req.body;
		if(event.name !== name) {
			event.name = name;
			event.url = name.replace(/\s+/g, '-').toLowerCase().replace(/^-+|-+(?=-|$)/g, '').replace(/[^a-zA-Z0-9-_]/g, '') + '-' + Date.now().toString().slice(-5);
		}
		event.description = description;
		event.eventStart = startTime;
		event.eventEnd = endTime;
		
		const computedPositions = [];

		for(const pos of JSON.parse(positions)) {
			const thePos = pos.match(/^([A-Z]{3})_(?:[A-Z0-9]{1,3}_)?([A-Z]{3})$/); // 🤮 so basically this extracts the first part and last part of a callsign.
			if(['CTR'].includes(thePos[2])) {
				computedPositions.push({
					pos,
					type: thePos[2],
					code: 'enroute',
				})
			}
			if(['APP', 'DEP'].includes(thePos[2])) {
				computedPositions.push({
					pos,
					type: thePos[2],
					code: (thePos[1] === "PHX") ? 'p50' : 'app',
				})
			}
			if(['TWR'].includes(thePos[2])) {
				computedPositions.push({
					pos,
					type: thePos[2],
					code: (thePos[1] === "PHX") ? 'kphxtower' : 'twr',
				})
			}
			if(['GND', 'DEL'].includes(thePos[2])) {
				computedPositions.push({
					pos,
					type: thePos[2],
					code: (thePos[1] === "PHX") ? 'kphxground' : 'gnd',
				})
			}
		}

		if(event.positions.length > 0) {

			const newPositions = [];

			for(let position of computedPositions) {
				newPositions.push(position);
				for(let i = 0; i < event.positions.length; i++) {
					if(event.positions[i].pos === position.pos) {

						if(event.positions[i].takenBy) {
							console.log(event.positions[i].takenBy);
							const j = newPositions.indexOf(position);
							newPositions[j].takenBy = event.positions[i].takenBy;
						}
					}
				}
			}

			event.positions = newPositions;
		} else {
			event.positions = computedPositions;
		}

		if(req.file) {
			const allowedTypes = ['image/jpg', 'image/jpeg', 'image/png', 'image/gif'];
			const fileType = await fileTypeFromFile(req.file.path);
			if(fileType === undefined || !allowedTypes.includes(fileType.mime)) {
				throw {
					code: 400,
					message: "File type not supported"
				}
			}
			if(req.file.size > (6 * 1024 * 1024)) {	// 6MiB
				throw {
					code: 400,
					message: "File too large"
				}
			}
			const tmpFile = await fs.readFile(req.file.path);
			await req.app.s3.putObject({
				Bucket: 'zabartcc/events',
				Key: req.file.filename,
				Body: tmpFile,
				ContentType: req.file.mimetype,
				ACL: 'public-read',
				ContentDisposition: 'inline',
			}).promise();
			
			event.bannerUrl = req.file.filename;
		}

		await event.save();

		await req.app.dossier.create({
			by: res.user.cid,
			affected: -1,
			action: `%b updated the event *${event.name}*.`
		});
	} catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.delete('/:slug', getUser, auth(['atm', 'datm', 'ec']), async (req, res) => {
	try {
		const deleteEvent = await Event.findOne({url: req.params.slug});
		await deleteEvent.delete();

		await req.app.dossier.create({
			by: res.user.cid,
			affected: -1,
			action: `%b deleted the event *${deleteEvent.name}*.`
		});

	} catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

// router.put('/:slug/assign', getUser, auth(['atm', 'datm', 'ec']), async (req, res) => {
// 	try {
// 		const event = await Event.findOneAndUpdate({url: req.params.slug}, {
// 			$set: {
// 				positions: req.body.assignment
// 			}
// 		});
		
// 		await req.app.dossier.create({
// 			by: res.user.cid,
// 			affected: -1,
// 			action: `%b updated the positions assignments for the event *${event.name}*.`
// 		});
// 	} catch (e) {
// 		req.app.Sentry.captureException(e);
// 		res.stdRes.ret_det = e;
// 	}

// 	return res.json(res.stdRes);
// });

router.put('/:slug/assign', getUser, auth(['atm', 'datm', 'ec']), async (req, res) => {
	try {
		const {position, cid} = req.body;

		const event = await Event.findOneAndUpdate({url: req.params.slug, "positions._id": position}, {
			$set: {
				'positions.$.takenBy': cid || null
			}
		});

		const [assignedPosition] = event.positions.filter(pos => pos._id == position);

		if(cid) {
			await req.app.dossier.create({
				by: res.user.cid,
				affected: cid,
				action: `%b assigned %a to *${assignedPosition.pos}* for *${event.name}*.`
			});
		} else {
			await req.app.dossier.create({
				by: res.user.cid,
				affected: -1,
				action: `%b unassigned *${assignedPosition.pos}* for *${event.name}*.`
			});
		}
		
		res.stdRes.data = assignedPosition;

	} catch (e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.put('/:slug/notify', getUser, auth(['atm', 'datm', 'ec']), async (req, res) => {
	try {
		await Event.updateOne({url: req.params.slug}, {
			$set: {
				positions: req.body.assignment,
				submitted: true
			}
		});

		const getSignups = await Event.findOne({url: req.params.slug }, 'name url signups').populate('signups.user', 'fname lname email').lean();
		getSignups.signups.forEach(async (signup) => {
			await transporter.sendMail({
				to: signup.user.email,
				from: {
					name: "Albuquerque ARTCC",
					address: 'noreply@zabartcc.org'
				},
				subject: `Position Assignments for ${getSignups.name} | Albuquerque ARTCC`,
				template: 'event',
				context: {
					eventTitle: getSignups.name,
					name: `${signup.user.fname} ${signup.user.lname}`,
					slug: getSignups.url
				}
			});
		});

		await req.app.dossier.create({
			by: res.user.cid,
			affected: -1,
			action: `%b notified controllers of positions for the event *${getSignups.name}*.`
		});
	} catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.put('/:slug/close', getUser, auth(['atm', 'datm', 'ec']), async (req, res) => {
	try {
		await Event.updateOne({url: req.params.slug}, {
			$set: {
				open: false
			}
		});
	} catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

export default router;