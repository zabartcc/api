import express from 'express';
const router = express.Router();
import PilotOnline from '../models/PilotOnline.js';
import AtcOnline from '../models/AtcOnline.js';

router.get('/', async ({res}) => {
	const pilots = await PilotOnline.find().lean();
	const atc = await AtcOnline.find().lean({virtuals: true});
	res.json({
		pilots: pilots,
		atc: atc
	});
});


export default router;