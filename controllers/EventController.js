import e from 'express';
import m from 'mongoose';
import transporter from '../config/mailer.js';
import multer from 'multer';
import minio from 'minio';
import FileType from 'file-type';

const allowedTypes = ['image/jpg', 'image/jpeg', 'image/png', 'image/gif'];
const minioClient = new minio.Client({
	endPoint: 'cdn.zabartcc.org',
	port: 443,
	useSSL: true,
	accessKey: process.env.MINIO_ACCESS_KEY,
	secretKey: process.env.MINIO_SECRET_KEY
});

const router = e.Router();
import Event from '../models/Event.js';
import User from '../models/User.js';
import isStaff from '../middleware/isStaff.js';



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

router.put('/:slug/mansignup/:user', isStaff, async (req, res) => {
	console.log(req.header);
	const user = await User.findOne({cid: req.params.user});
	if(user !== null) {
		await Event.updateOne({url: req.params.slug}, {
			$push: {
				signups: {
					user: m.Types.ObjectId(user.id),
				} 
			}
		});
		return res.sendStatus(200);
	} else {
		return res.status(500).send('Controller not found.');
	}
});

router.post('/new', multer({storage: multer.memoryStorage(), limits: { fileSize: 6000000 }}).single("banner"), isStaff, async (req, res) => { // 6 MB max
	const stamp = Date.now();
	const url = req.body.name.replace(/\s+/g, '-').toLowerCase().replace(/^-+|-+(?=-|$)/g, '').replace(/[^a-zA-Z0-9-_]/g, '') + '-' + stamp.toString().slice(-5);
	const positions = [];
	const positionsJSON = JSON.parse(req.body.positions);
	positionsJSON.center.forEach((obj) => positions.push(obj));
	positionsJSON.tracon.forEach((obj) => positions.push(obj));
	positionsJSON.local.forEach((obj) => positions.push(obj));
	const getType = await FileType.fromBuffer(req.file.buffer);
	if(getType !== undefined && allowedTypes.includes(getType.mime)) {
		minioClient.putObject("events", req.file.originalname, req.file.buffer, {
			'Content-Type': getType.mime
		}, (error) => {
			if(error) {
				console.log(error);
				return res.status(500).send('Something went wrong, please try again.');
			}
		});
		Event.create({
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
		}).then(() => {
			res.sendStatus(200);
		}).catch((err) => {
			console.log(err);
			res.sendStatus(500);
		});
	} else {
		return res.status(500).send('File format not allowed.');
	}
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

router.put('/:slug/notify', isStaff, async (req, res) => {
	const assignments = req.body.assignment;
	Event.updateOne({url: req.params.slug}, {
		$set: {
			positions: assignments,
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