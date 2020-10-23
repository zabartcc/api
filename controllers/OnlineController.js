import express from 'express';
const router = express.Router();
import PilotOnline from '../models/PilotOnline.js';
import AtcOnline from '../models/AtcOnline.js';

router.get('/pilots', async ({res}) => {
	const pilots = await PilotOnline.find();
	res.json(pilots);
});

router.get('/atc', async ({res}) => {
	const atc = await AtcOnline.find();
	res.json(atc);
});


export default router;