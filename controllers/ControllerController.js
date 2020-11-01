import e from 'express';
const router = e.Router();
import User from '../models/User.js';


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

router.get('/find/:cid', async (req, res) => {
	const user = await User.findOne({cid: req.params.cid}).populate('roles').populate('certifications');
	res.json(user);
});

router.get('/oi', async (req, res) => {
	const oi = await User.find().select('oi');
	res.json(oi);
});

export default router;