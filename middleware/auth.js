export default function (roles) {
	return function (req, res, next) {
		if(!res.user) {
			req.app.Sentry.captureMessage('User attempted to access an auth route without being logged in.');
			res.stdRes.ret_det.code = 401;
			res.stdRes.ret_det.message = "Not authorized.";
			return res.json(res.stdRes);
		} else {
			const havePermissions = roles.some(r => res.user.roleCodes.includes(r));
			if(havePermissions) {
				next();
			} else {
				req.app.Sentry.captureMessage('User attempted to access an auth route without having permissions.');
				res.stdRes.ret_det.code = 403;
				res.stdRes.ret_det.message = "Not authorized.";
				return res.json(res.stdRes);
			}
		}
	};
};