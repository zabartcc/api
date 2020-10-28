import e from 'express';
import m from 'mongoose';
const router = e.Router();
import Event from '../models/Event.js';


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

router.get('/id/:id', async(req, res) => {
    var id = req.params.id;
    const event = await Event.find({
        url: id
    }).select(['-positions']);
    res.json(event);
});

router.get('/assignments/:id', async(req, res) => {
    var id = req.params.id;
    const assignments = await Event.find({
        url: id
    }).select(['open', 'positions', 'signups']).populate('positions.taken', 'cid fname lname').populate('signups.user', 'cid');
    res.json(assignments);
});

router.put('/assignments/:id/user/:uid', async(req, res) => {
	var id = req.params.id.toString();
	var uid = req.params.uid.toString();
	const deleteSignup = await Event.updateOne({url: id}, {
		$pull: {
			signups: {
				user: m.Types.ObjectId(uid)
			}
		}
	});
	const deletePositionTaken = await Event.updateOne({"url": id, "positions.taken": m.Types.ObjectId(uid)}, {
		"$set": {
			"positions.$.taken": undefined
		}
	});
	res.json({signup: deleteSignup, position: deletePositionTaken});
})

export default router;