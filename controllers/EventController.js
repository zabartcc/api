import e from 'express';
import m from 'mongoose';
import transporter from '../config/mailer.js';
import aws from 'aws-sdk';
import multer from 'multer';
import FileType from 'file-type';
import fs from 'fs/promises';
const router = e.Router();
import Event from '../models/Event.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import {isStaff} from '../middleware/isStaff.js';
import getUser from '../middleware/getUser.js';
import {management} from '../middleware/auth.js';


const s3 = new aws.S3({
	endpoint: new aws.Endpoint('sfo3.digitaloceanspaces.com'),
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

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
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.get('/archive', async(req, res) => {
	try {
		const page = parseInt(req.query.page, 10);
		const limit = parseInt(req.query.limit, 10);

		const count = await Event.countDocuments({
			eventStart: {
				$lt: new Date(new Date().toUTCString())
			},
			deleted: false
		});
		const events = await Event.find({
			eventStart: {
				$lt: new Date(new Date().toUTCString())
			},
			deleted: false
		}).skip(limit * (page - 1)).limit(limit).sort({eventStart: "desc"}).lean();

		res.stdRes.data = {
			amount: count,
			events: events
		};
	} catch(e) {
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
			'positions.user', 'cid fname lname'
		).populate(
			'signups.user', 'cid fname lname rating ratingLong certCodes requests'
		).lean();

		res.stdRes.data = event;
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.put('/:slug/signup', getUser, async (req, res) => {
	try {
		await Event.updateOne({url: req.params.slug}, {
			$push: {
				signups: {
					cid: res.user.cid,
					requests: req.body.requests
				} 
			}
		});
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.delete('/:slug/signup', getUser, async (req, res) => {
	try {
		await Event.updateOne({url: req.params.slug}, {
			$pull: {
				signups: {
					cid: res.user.cid
				}
			}
		});
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.delete('/:slug/mandelete/:cid', getUser, management, async(req, res) => {
	try {
		await Event.updateOne({url: req.params.slug}, {
			$pull: {
				signups: {
					cid: req.params.cid
				}
			}
		});
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.put('/:slug/mansignup/:cid', getUser, management, async (req, res) => {
	try {
		const user = await User.findOne({cid: req.params.cid});
		if(user !== null) {
			await Event.updateOne({url: req.params.slug}, {
				$push: {
					signups: {
						cid: req.params.cid,
					} 
				}
			});
		} else {
			throw {
				code: 400,
				message: "Controller not found"
			};
		}
	} catch (e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.post('/', getUser, management, upload.single('banner'), async (req, res) => {
	try {
		console.log(req.body)
		const url = req.body.name.replace(/\s+/g, '-').toLowerCase().replace(/^-+|-+(?=-|$)/g, '').replace(/[^a-zA-Z0-9-_]/g, '') + '-' + Date.now().toString().slice(-5);
		// const positions = JSON.parse(req.body.positions);
		
		const allowedTypes = ['image/jpg', 'image/jpeg', 'image/png', 'image/gif'];
		const fileType = await FileType.fromFile(req.file.path);
		if(fileType === undefined || !allowedTypes.includes(fileType.mime)) {
			throw {
				code: 400,
				message: 'File type not supported.'
			}
		}
		if(req.file.size > (6 * 1024 * 1024)) {	// 6MiB
			throw {
				code: 400,
				message: 'File too large.'
			}
		}
		const tmpFile = await fs.readFile(req.file.path);
		await s3.putObject({
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
			eventStart: `${req.body.startTime}:00.000Z`, // force Mongo to store as-is and not try to convert to UTC
			eventEnd: `${req.body.endTime}:00.000Z`, // force Mongo to store as-is and not try to convert to UTC
			createdBy: res.user.cid,
			// positions: positions,
			open: true,
			submitted: false
		});
	} catch(e) {
		console.log(e)
		res.stdRes.ret_det = e;
	}
	return res.json(res.stdRes);
});

router.put('/:slug', getUser, management, upload.single('banner'), async (req, res) => {
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
			const thePos = pos.match(/^([A-Z]{3})_(?:[A-Z]{1,3}_)?([A-Z]{3})$/); // 🤮 so basically this extracts the first part and last part of a callsign.
			if(['CTR'].includes(thePos[2])) {
				computedPositions.push({
					pos,
					type: thePos[2],
					code: 'zab',
				})
			}
			if(['APP', 'DEP'].includes(thePos[2])) {
				computedPositions.push({
					pos,
					type: thePos[2],
					code: (thePos[1] === "PHX") ? 'p50app' : 'app',
				})
			}
			if(['TWR'].includes(thePos[2])) {
				computedPositions.push({
					pos,
					type: thePos[2],
					code: (thePos[1] === "PHX") ? 'p50twr' : 'twr',
				})
			}
			if(['GND', 'DEL'].includes(thePos[2])) {
				computedPositions.push({
					pos,
					type: thePos[2],
					code: (thePos[1] === "PHX") ? 'p50gnd' : 'gnd',
				})
			}
		}
		
		event.positions = computedPositions;

		console.log(computedPositions)

		if(req.file) {
			const allowedTypes = ['image/jpg', 'image/jpeg', 'image/png', 'image/gif'];
			const fileType = await FileType.fromFile(req.file.path);
			if(fileType === undefined || !allowedTypes.includes(fileType.mime)) {
				throw {
					code: 400,
					message: 'File type not supported.'
				}
			}
			if(req.file.size > (6 * 1024 * 1024)) {	// 6MiB
				throw {
					code: 400,
					message: 'File too large.'
				}
			}
			const tmpFile = await fs.readFile(req.file.path);
			await s3.putObject({
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
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.delete('/:slug', isStaff, async (req, res) => {
	try {
		const deleteEvent = await Event.findOne({url: req.params.slug});
		await deleteEvent.delete();

	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.put('/:slug/assign', isStaff, async (req, res) => {
	try {
		console.log(req.body)
		await Event.updateOne({url: req.params.slug}, {
			$set: {
				positions: req.body.assignment
			}
		});
	} catch (e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.put('/:slug/notify', isStaff, async (req, res) => {
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
				subject: `Position Assignments for ${getSignups.name} | Albuquerque ARTCC`,
				template: 'event',
				context: {
					eventTitle: getSignups.name,
					name: `${signup.user.fname} ${signup.user.lname}`,
					slug: getSignups.url
				}
			});
		});
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.put('/:slug/close', isStaff, async (req, res) => {
	try {
		await Event.updateOne({url: req.params.slug}, {
			$set: {
				open: false
			}
		});
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

export default router;