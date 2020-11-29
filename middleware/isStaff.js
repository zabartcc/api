import User from '../models/User.js';
import jwt from 'jsonwebtoken';

export function isStaff(req, res, next) {
	if(!req.headers.authorization) {
		res.sendStatus(401);
	} else {
		const userToken = req.headers.authorization.split(' ')[1];
		jwt.verify(userToken, process.env.JWT_SECRET, async (err, decoded) => {
			if(err) {
				console.log(`Unable to verify token: ${err}`);
				res.sendStatus(401);
			} else {
				const user = await User.findOne({
					cid: decoded.cid
				}).populate('roles');

				console.log(user);
				
				if(user.isStaff) {
					next();
				} else {
					res.sendStatus(403);
				}
			}
		});
	}
}

export function isMgt(req, res, next) {
	if(!req.headers.authorization) {
		res.sendStatus(401);
	} else {
		const userToken = req.headers.authorization.split(' ')[1];
		jwt.verify(userToken, process.env.JWT_SECRET, async (err, decoded) => {
			if(err) {
				console.log(`Unable to verify token: ${err}`);
				res.sendStatus(401);
			} else {
				const user = await User.findOne({
					cid: decoded.cid
				}).populate('roles');
				
				if(user.isMgt) {
					next();
				} else {
					res.sendStatus(403);
				}
			}
		});
	}
}