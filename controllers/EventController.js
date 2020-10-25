import e from 'express';
const router = e.Router();
import Event from '../models/Event.js';


router.get('/upcoming', async ({res}) => {
    const events = await Event.find({
        eventStart: {
            $gt: new Date() // event starts in the future
        }
    });
    res.json(events);
});

router.get('/past', async({res}) => {
    const events = await Event.find({
        eventStart: {
            $lt: new Date()
        }
    }).limit(10);
    res.json(events);
});

export default router;