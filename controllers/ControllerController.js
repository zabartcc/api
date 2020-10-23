import e from 'express';
const router = e.Router();
import User from '../models/User.js';


router.get('/', async ({res}) => {
	const users = await User.find({}, 'fname lname cid rating oi').sort({rating: 'descending'}).populate({
		path: 'certifications',
		options: {
			sort: {order: 'desc'}
		}
	}).populate({
		path: "roles",
		options: {
			sort: {order: 'asc'}
		}
	});
	res.json(users);
});

export default router;