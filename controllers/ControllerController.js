import e from 'express';
const router = e.Router();
import User from '../models/User.js';


router.get('/', async ({res}) => {
	const users = await User.find().sort({
		rating: 'desc',
		lname: 'asc',
		fname: 'asc'
	}).populate({
		path: 'certs',
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

router.get('/:cid', async (req, res) => {
	const user = await User.findOne({cid: req.params.cid}).populate('roles').populate('certifications');
	console.log(user);
	res.json(user);
});

export default router;