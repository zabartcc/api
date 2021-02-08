export const management = (req, res, next) => {
	if(!res.user || !res.user.isMgt) {
		res.stdRes.ret_det.code = 401;
		res.stdRes.ret_det.message = "Not authorized.";
		return res.json(res.stdRes);
	} else {
		next();
	}
};