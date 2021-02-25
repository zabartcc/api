import User from '../models/User.js';
import jwt from 'jsonwebtoken';

export function isSelf (req, res, next) {
	if(!req.cookies.token) {
		return res.sendStatus(401);
	} else {
		const userToken = req.cookies.token;
		const userId = req.params.id;
		jwt.verify(userToken, process.env.JWT_SECRET, async (err, decoded) => {
			if(err) {
				console.log(`Unable to verify token: ${err}`);
				return res.sendStatus(401);
			} else {
				const user = await User.findOne({
					cid: decoded.cid
				}).lean();
				if(user._id.toString() === userId) {
					next();
				} else {
					return res.sendStatus(403);
				}
			}
		});
	}
}