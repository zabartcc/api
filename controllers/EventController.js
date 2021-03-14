import e from 'express';
import m from 'mongoose';
import transporter from '../config/mailer.js';
import multer from 'multer';
import minio from 'minio';
import FileType from 'file-type';
const router = e.Router();
import Event from '../models/Event.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import {isStaff} from '../middleware/isStaff.js';
import getUser from '../middleware/getUser.js';

const allowedTypes = ['image/jpg', 'image/jpeg', 'image/png', 'image/gif'];
const minioClient = new minio.Client({
	endPoint: 'cdn.zabartcc.org',
	port: 443,
	useSSL: true,
	accessKey: process.env.MINIO_ACCESS_KEY,
	secretKey: process.env.MINIO_SECRET_KEY
});

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
			'positions.takenBy', 'cid fname lname'
		).populate({
			path: 'signups.user', select: 'cid fname lname rating certifications requests', populate: {path: 'certifications', select: 'code'}
		}).lean();

		res.stdRes.data = event;
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.put('/:slug/signup', getUser, async (req, res) => {
	try {
		const user = await User.findOne({cid: res.user.cid});
		await Event.updateOne({url: req.params.slug}, {
			$push: {
				signups: {
					user: m.Types.ObjectId(user._id),
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
		const user = await User.findOne({cid: res.user.cid});
		await Event.updateOne({url: req.params.slug}, {
			$pull: {
				signups: {
					user: m.Types.ObjectId(user._id)
				}
			}
		});
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.delete('/:slug/mandelete/:cid', isStaff, async(req, res) => {
	try {
		const user = await User.findOne({cid: req.params.cid});
		await Event.updateOne({url: req.params.slug}, {
			$pull: {
				signups: {
					user: m.Types.ObjectId(user._id)
				}
			}
		});
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.put('/:slug/mansignup/:cid', isStaff, async (req, res) => {
	try {
		const user = await User.findOne({cid: req.params.cid});
		if(user !== null) {
			await Event.updateOne({url: req.params.slug}, {
				$push: {
					signups: {
						user: m.Types.ObjectId(user.id),
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

router.post('/new', multer({storage: multer.memoryStorage(), limits: { fileSize: 6000000 }}).single("banner"), isStaff, async (req, res) => { // 6 MB max
	try {
		const stamp = Date.now();
		const url = req.body.name.replace(/\s+/g, '-').toLowerCase().replace(/^-+|-+(?=-|$)/g, '').replace(/[^a-zA-Z0-9-_]/g, '') + '-' + stamp.toString().slice(-5);
		const positions = JSON.parse(req.body.positions);
		//const getType = await FileType.fromBuffer(req.file.buffer);

		//if(getType !== undefined && allowedTypes.includes(getType.mime)) {
			/*minioClient.putObject("events", req.file.originalname, req.file.buffer, {
				'Content-Type': getType.mime
			}, (error) => {
				if(error) {
					console.log(error);
					throw {
						code: 500,
						message: "Could not upload file to server"
					};
				}
			});*/
			await Event.create({
				name: req.body.name,
				description: req.body.description,
				url: url,
				bannerUrl: req.file.originalname,
				eventStart: req.body.startTime,
				eventEnd: req.body.endTime,
				createdBy: req.body.createdBy,
				positions: positions,
				open: true,
				submitted: false
			});

			await Notification.create({
				
			})
		/*} else {
			throw {
				code: 400,
				message: "File type not allowed"
			};
		}*/
	} catch(e) {
		res.stdRes.ret_det = e;
	}
	return res.json(res.stdRes);
});

router.put('/:slug', multer({storage: multer.memoryStorage(), limits: { fileSize: 6000000 }}).single("banner"), isStaff, async (req, res) => {
	try {
		const stamp = Date.now();
		if(!req.file) { // no updated file provided
			const positions = JSON.parse(req.body.positions);
			await Event.findOneAndUpdate({url: req.params.slug}, {
				name: req.body.name,
				description: req.body.description,
				eventStart: req.body.startTime,
				eventEnd: req.body.endTime,
				positions: positions
			});
		} else {
			const banner = await Event.findOne({url: req.params.slug}).select('bannerUrl').lean();
			const fileName = banner.bannerUrl;
			/*minioClient.removeObject("events", fileName, (error) => {
				if (error) {
					console.log(error);
					return res.sendStatus(500);
				}
			});
			const getType = await FileType.fromBuffer(req.file.buffer);
			if(getType !== undefined && allowedTypes.includes(getType.mime)) {
				minioClient.putObject("events", req.file.originalname, req.file.buffer, {
					'Content-Type': getType.mime
				}, (error) => {
					if(error) {
						return res.sendStatus(500);
					} else {
						const url = req.body.name.replace(/\s+/g, '-').toLowerCase().replace(/^-+|-+(?=-|$)/g, '').replace(/[^a-zA-Z0-9-_]/g, '') + '-' + stamp.toString().slice(-5);
						const positions = JSON.parse(req.body.positions);
						await Event.findOneAndUpdate({url: req.params.slug}, {
							name: req.body.name,
							description: req.body.description,
							url: url,
							bannerUrl: req.file.originalname,
							eventStart: req.body.startTime,
							eventEnd: req.body.endTime,
							positions: positions
						});
					}
				});
			} else {
				return res.sendStatus(500);
			}*/
		}
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