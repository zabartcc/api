export default function(req, res, next) {
	const response = {
		ret_det: {
			code: 200,
			message: '',
		}, 
		data: {}
	};

	res.stdRes = response;

	next();
}