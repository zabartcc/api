import express from 'express';
const router = express.Router();
import PilotOnline from '../models/PilotOnline.js';
import AtcOnline from '../models/AtcOnline.js';
import Pireps from '../models/Pireps.js';

router.get('/', async ({res}) => {
	const pilots = await PilotOnline.find().lean();
	const atc = await AtcOnline.find().lean({virtuals: true});
	return res.json({
		pilots: pilots,
		atc: atc
	});
});


router.get('/pireps', async({res}) => {
	const pirep = await Pireps.find().sort('-reportTime').lean();
	return res.json(pirep);
});

// To-do: add user authentication to below end points

router.post('/pireps', async(req, res) => {
	if(req.body.ua === undefined || req.body.ov === undefined) {
		return res.status(500).send('Missing UA or OV');
	} else {
		await Pireps.create({
			reportTime: new Date().getTime(),
			aircraft: req.body.tp,
			flightLevel: req.body.fl,
			skyCond: req.body.sk,
			turbulence: req.body.tb,
			icing: req.body.ic,
			vis: req.body.wx,
			temp: req.body.ta,
			wind: req.body.wv,
			urgent: req.body.ua === 'UUA' ? true : false,
			manual: true
		});
		return res.sendStatus(200);
	}
});

router.delete('/pireps/:id', async(req, res) => {
	Pireps.findByIdAndDelete(req.params.id).then(() => {
		return res.sendStatus(200);
	}).catch((err) => {
		console.log(err);
		return res.sendStatus(500);
	});
});

export default router;