import User from '../models/User.js';
import jwt from 'jsonwebtoken';

export default function(req, res, next) {
	const userToken = req.headers.authorization.split(' ')[1];
	if(!userToken) {
		res.sendStatus(401);
	} else {
		jwt.verify(userToken, process.env.JWT_SECRET, async (err, decoded) => {
			if(err) {
				console.log(`Unable to verify token: ${err}`);
				res.sendStatus(401);
			} else {
				const user = await User.findOne({
					cid: decoded.cid
				});
				
				
				if(user.isStaff) {
					next();
				} else {
					res.sendStatus(401);
				}
			}
		});
	}
}