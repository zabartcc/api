import e from 'express';
import m from 'mongoose';
import dotenv from 'dotenv';
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
			callback(null, true);
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
		}
	}).sort({eventStart: 'ascending'});
	res.json(events);
});

router.get('/archive', async({res}) => {
	const events = await Event.find({
		eventStart: {
			$lt: new Date()
		}
	}).limit(10);
	res.json(events);

});

router.get('/:slug', async(req, res) => {
	const slug = req.params.slug;
	const event = await Event.findOne({
		url: slug
	});
	res.json(event);
});

router.get('/:slug/positions', async(req, res) => {
	const slug = req.params.slug;
	const event = await Event.findOne({
		url: slug
	}).sort({'positions.order': -1}).select(['open', 'positions', 'signups']).populate('positions.takenBy', 'cid fname lname').populate('signups.user', 'cid requests');
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
			try {
				await Event.create({
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
				});
				res.status(200).send('Event succesfully created!');
			} catch (err) {
				console.log(err);
				res.status(500).send('Something went wrong, please try again.');
			}
		}
	});
});

export default router;