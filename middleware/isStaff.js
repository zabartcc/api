import User from '../models/User.js';
import jwt from 'jsonwebtoken';

export function isIns(req, res, next) {
	if(!req.cookies.token) {
		return res.sendStatus(401);
	} else {
		const userToken = req.cookies.token;
		jwt.verify(userToken, process.env.JWT_SECRET, async (err, decoded) => {
			if(err) {
				console.log(`Unable to verify token: ${err}`);
				return res.sendStatus(401);
			} else {
				const user = await User.findOne({
					cid: decoded.cid
				}).populate('roles').lean({virtuals: true});
				if(user.isIns) {
					next();
				} else {
					return res.sendStatus(403);
				}
			}
		});
	}
}

export function isStaff(req, res, next) {
	if(!req.cookies.token) {
		return res.sendStatus(401);
	} else {
		const userToken = req.cookies.token;
		jwt.verify(userToken, process.env.JWT_SECRET, async (err, decoded) => {
			if(err) {
				console.log(`Unable to verify token: ${err}`);
				return res.sendStatus(401);
			} else {
				const user = await User.findOne({
					cid: decoded.cid
				}).populate('roles').lean({virtuals: true});
				if(user.isStaff) {
					next();
				} else {
					return res.sendStatus(403);
				}
			}
		});
	}
}

export function isSenior(req, res, next) {
	if(!req.cookies.token) {
		return res.sendStatus(401);
	} else {
		const userToken = req.cookies.token;
		jwt.verify(userToken, process.env.JWT_SECRET, async (err, decoded) => {
			if(err) {
				console.log(`Unable to verify token: ${err}`);
				return res.sendStatus(401);
			} else {
				const user = await User.findOne({
					cid: decoded.cid
				}).populate('roles').lean({virtuals: true});	
				if(user.isSenior) {
					next();
				} else {
					return res.sendStatus(403);
				}
			}
		});
	}
}

export function isMgt(req, res, next) {
	if(!req.cookies.token) {
		return res.sendStatus(401);
	} else {
		const userToken = req.cookies.token;
		jwt.verify(userToken, process.env.JWT_SECRET, async (err, decoded) => {
			if(err) {
				console.log(`Unable to verify token: ${err}`);
				return res.sendStatus(401);
			} else {
				const user = await User.findOne({
					cid: decoded.cid
				}).populate('roles').lean({virtuals: true});	
				if(user.isMgt) {
					next();
				} else {
					return res.sendStatus(403);
				}
			}
		});
	}
}