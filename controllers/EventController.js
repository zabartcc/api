import e from 'express';
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

export default router;