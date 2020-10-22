import express from 'express';
const router = express.Router();
import AtcOnline from '../models/AtcOnline.js';

router.get('/', async ({res}) => {
	const atc = await AtcOnline.find();

	res.json(atc);
});

export default router;