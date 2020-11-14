import e from 'express';
import m from 'mongoose';
import dotenv from 'dotenv';
import transporter from '../config/mailer.js';
const router = e.Router();
import Event from '../models/Event.js';
import User from '../models/User.js';
import multer from 'multer';
import path from 'path';
import isStaff from '../middleware/isStaff.js';

const multerConf = multer({
	storage: multer.diskStorage({
		destination: (req, file, callback) => {
			callback(null, process.env.UPLOAD_DIR);
		},
		filename: (req, file, callback) => {
			callback(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
		}
	}),
	fileFilter: (req, file, callback) => {
		if(file.mimetype === "image/png" || file.mimetype === "image/jpg" || file.mimetype === "image/jpeg" || file.mimetype === "image/gif") {
			return callback(null, true);
		} else {
			callback(null, false);
			return callback(new Error('File format now allowed.'));
		}
	}
});

let upload = multerConf.single('banner');


router.get('/', async ({res}) => {
	const events = await Event.find({
		eventEnd: {
			$gt: new Date() // event starts in the future
		},
		deletedAt: null
	}).sort({eventStart: 'ascending'});
	res.json(events);
});

router.get('/archive', async({res}) => {
	const events = await Event.find({
		eventStart: {
			$lt: new Date()
		},
		deletedAt: null
	}).limit(10);
	res.json(events);

});

router.get('/:slug', async(req, res) => {
	const slug = req.params.slug;
	const event = await Event.findOne({
		url: slug,
		deletedAt: null
	});
	res.json(event);
});

router.get('/:slug/positions', async(req, res) => {
	const slug = req.params.slug;
	const event = await Event.findOne({
		url: slug,
		deletedAt: null
	}).sort({'positions.order': -1}).select(['open', 'submitted', 'eventStart', 'positions', 'signups']).populate('positions.takenBy', 'cid fname lname').populate({path: 'signups.user', select: 'cid fname lname rating certifications requests', populate: {path: 'certifications', select: 'code'}});
	res.json(event);
});

router.put('/:slug/signup/:cid', async (req, res) => {
	const user = await User.findOne({cid: req.params.cid});
	const addSignup = await Event.updateOne({url: req.params.slug}, {
		$push: {
			signups: {
				user: m.Types.ObjectId(user.id),
				requests: req.body.requests
			} 
		}
	});
	if(addSignup.ok) {
		res.sendStatus(200);
	} else {
		res.sendStatus(500);
	}
});

router.delete('/:slug/signup/:cid', async (req, res) => {
	const user = await User.findOne({cid: req.params.cid});
	const deleteSignup = await Event.updateOne({url: req.params.slug}, {
		$pull: {
			signups: {
				user: m.Types.ObjectId(user.id)
			}
		}
	});
	if(deleteSignup.ok) {
		res.sendStatus(200);
	} else {
		res.sendStatus(500);
	}
});

router.post('/new', isStaff, async (req, res) => {
	upload(req, res, async function (err) {
		if(err) {
			res.status(500).send('File type not allowed.');
		} else {
			const url = req.body.name.replace(/\s+/g, '-').toLowerCase().replace(/^-+|-+(?=-|$)/g, '').replace(/[^a-zA-Z0-9-_]/g, '');
			const positions = [];
			const positionsJSON = JSON.parse(req.body.positions);
			positionsJSON.center.forEach((obj) => positions.push(obj));
			positionsJSON.tracon.forEach((obj) => positions.push(obj));
			positionsJSON.local.forEach((obj) => positions.push(obj));
			Event.create({
				name: req.body.name,
				description: req.body.description,
				url: url,
				bannerUrl: req.file.filename,
				eventStart: req.body.startTime,
				eventEnd: req.body.endTime,
				createdBy: req.body.createdBy,
				positions: positions,
				open: true,
				submitted: false
			}).then(() => {
				res.sendStatus(200);
			}).catch((err) => {
				console.log(err);
				res.sendStatus(500);
			});
		}
	});
});

router.delete('/:slug', isStaff, async (req, res) => {
	const deleteEvent = await Event.findOne({url: req.params.slug});
	await deleteEvent.delete();
	res.sendStatus(200);
});

router.put('/:slug/assign', isStaff, async (req, res) => {
	const assignments = req.body.assignment;
	const setAssignments = await Event.updateOne({url: req.params.slug}, {
		$set: {
			positions: assignments
		}
	});
	if(setAssignments.ok) {
		res.sendStatus(200);
	} else {
		res.sendStatus(500);
	}
});

router.put('/:slug/finalize', isStaff, async (req, res) => {
	const assignments = req.body.assignment;
	Event.updateOne({url: req.params.slug}, {
		$set: {
			positions: assignments,
			open: false,
			submitted: true
		}
	}).then(async () => {
	//send email;
		const getSignups = await Event.findOne({url: req.params.slug }, 'name url signups').populate('signups.user', 'fname lname email').lean();
		try {
			getSignups.signups.forEach((signup) => {
				transporter.sendMail({
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
			return res.sendStatus(200);
		} catch(e) {
			console.log(e);
			return res.sendStatus(500);
		}
	}).catch((err) => {
		console.log(err);
		return res.sendStatus(500);
	});
});

export default router;