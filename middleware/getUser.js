import User from '../models/User.js';
import jwt from 'jsonwebtoken';

export default function(req, res, next) {
	const userToken = req.cookies.token || '';
	jwt.verify(userToken, process.env.JWT_SECRET, async (err, decoded) => {
		if(err) {
			res.user = null;
		} else {
			const user = await User.findOne({
				cid: decoded.cid
			}).populate('roles');
			res.user = user;
		}
		next();
	});

}