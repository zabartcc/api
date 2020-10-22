import express from 'express';
const router = express.Router();
import PilotOnline from '../models/PilotOnline.js';

router.get('/', async ({res}) => {
	const pilots = await PilotOnline.find();

	res.json(pilots);
});

export default router;