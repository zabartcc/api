import User from '../models/User.js';
import jwt from 'jsonwebtoken';

export default function(req, res, next) {
	const userToken = req.cookies.token;
	jwt.verify(userToken, process.env.JWT_SECRET, async (err, decoded) => {
		if(err) {
			throw {
				code: 401,
				message: `Unable to verify token: ${err}`
			};
		} else {
			const user = await User.findOne({
				cid: decoded.cid
			});
			res.user = user;
			next();
		}
	});

}