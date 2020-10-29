import e from 'express';
import m from 'mongoose';
const router = e.Router();
import Event from '../models/Event.js';
import User from '../models/User.js';


router.get('/', async ({res}) => {
	const events = await Event.find({
		eventStart: {
			$gt: new Date() // event starts in the future
		}
	});
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
	}).select(['open', 'positions', 'signups']).populate('positions.takenBy', 'cid fname lname').populate('signups.user', 'cid requests');
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

export default router;