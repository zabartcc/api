import e from 'express';
const router = e.Router();
import User from '../models/User.js';
import Role from '../models/Role.js';
import Certification from '../models/Certification.js';

import isStaff from '../middleware/isStaff.js';

router.get('/', async ({res}) => {
	const users = await User.find().sort({
		rating: 'desc',
		lname: 'asc',
		fname: 'asc'
	}).populate({
		path: 'certifications',
		options: {
			sort: {order: 'desc'}
		}
	}).populate({
		path: 'roles',
		options: {
			sort: {order: 'asc'}
		}
	}).lean({virtuals: true});


	res.json(users);
});

router.get('/oi', async (req, res) => {
	const oi = await User.find().select('oi').lean();
	res.json(oi);
});

router.get('/:cid', async (req, res) => {
	const user = await User.findOne({cid: req.params.cid}).populate('roles').populate('certifications');
	res.json(user);
});

router.post('/:cid', isStaff, async (req, res) => {
	if(!req.body.form) res.sendStatus(400);
	const {fname, lname, email, oi, roles, certs} = req.body.form;
	const toApply = {
		roles: [],
		certifications: []
	};

	for(const [code, set] of Object.entries(roles)) {
		if(set) {
			const theRole = await Role.findOne({code}, 'id');
			toApply.roles.push(theRole.id);
		}
	}

	for(const [code, set] of Object.entries(certs)) {
		if(set) {
			const theCert = await Certification.findOne({code}, 'id');
			toApply.certifications.push(theCert.id);
		}
	}

	const updated = await User.findOneAndUpdate({cid: req.params.cid}, {
		fname,
		lname, 
		email,
		oi,
		roles: toApply.roles,
		certifications: toApply.certifications,
	});
	
	if(updated.ok) {
		res.sendStatus(200);
	} else {
		res.sendStatus(500);
	}
});

export default router;