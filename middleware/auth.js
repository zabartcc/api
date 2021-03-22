export default function (roles) {
	return function (req, res, next) {
		if(!res.user) {
			res.stdRes.ret_det.code = 401;
			res.stdRes.ret_det.message = "Not authorized.";
			return res.json(res.stdRes);
		} else {
			const havePermissions = roles.some(r => res.user.roleCodes.includes(r));
			if(havePermissions) {
				next();
			} else {
				res.stdRes.ret_det.code = 403;
				res.stdRes.ret_det.message = "Not authorized.";
				return res.json(res.stdRes);
			}
		}
	};
};