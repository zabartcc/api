import express from 'express';
const router = express.Router();
import PilotOnline from '../models/PilotOnline.js';
import AtcOnline from '../models/AtcOnline.js';
import AtisOnline from '../models/AtisOnline.js';
import Pireps from '../models/Pireps.js';

router.get('/', async ({res}) => {
	const pilots = await PilotOnline.find().lean();
	const atc = await AtcOnline.find().lean({virtuals: true});
	return res.json({
		pilots: pilots,
		atc: atc
	});
});

router.get('/atis', async({res}) => {
	const atis = await AtisOnline.find().lean();
	return res.json(atis);
});

router.get('/pireps', async({res}) => {
	const pirep = await Pireps.find().lean();
	return res.json(pirep);
});


export default router;