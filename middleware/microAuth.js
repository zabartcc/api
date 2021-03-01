import { config } from 'dotenv';

config();

export default function(req, res, next) {
	if(!req.headers.authorization || req.headers.authorization !== `Bearer ${process.env.MICRO_ACCESS_KEY}`) {
		res.stdRes.ret_det.code = 400;
		res.stdRes.ret_det.message = "Not authorized.";
		return res.json(res.stdRes);
	} else {
		next();
	}
}