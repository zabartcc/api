import e from 'express';
const router = e.Router();
import getUser from '../middleware/getUser.js';
import auth from '../middleware/auth.js';
import News from '../models/News.js';

router.get('/', async (req, res) => {

	const page = +req.query.page || 1;
	const limit = +req.query.limit || 20;

	const amount = await News.countDocuments({deleted: false});
	const news = await News.find({deleted: false}).sort({createdAt: 'desc'}).skip(limit * (page - 1)).limit(limit).populate('user', ['fname', 'lname']).lean();

	res.stdRes.amount = amount;
	res.stdRes.data = news;

	return res.json(res.stdRes);
});

router.post('/', getUser, auth(['atm', 'datm', 'ta', 'ec', 'fe', 'wm']), async (req, res) => {
	try {
		if(!req.body || !req.body.title || !req.body.content) {
			throw {
				code: 400,
				message: "You must fill out all required forms"
			};
		}
		const {title, content, createdBy} = req.body;
		const uriSlug = title.replace(/\s+/g, '-').toLowerCase().replace(/^-+|-+(?=-|$)/g, '').replace(/[^a-zA-Z0-9-_]/g, '') + '-' + Date.now().toString().slice(-5);
		const news = await News.create({
			title,
			content,
			uriSlug,
			createdBy
		});
		
		if(!news) {
			throw {
				code: 500,
				message: "Something went wrong, please try again"
			};
		}

		await req.app.dossier.create({
			by: res.user.cid,
			affected: -1,
			action: `%b created the news item *${req.body.title}*.`
		});

	}
	catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
});

router.get('/:slug', async (req, res) =>{
	try {
		const newsItem = await News
			.findOne({uriSlug: req.params.slug})
			.populate('user', 'fname lname')
			.lean();
	
		res.stdRes.data = newsItem;
	}
	catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
});

router.put('/:slug', getUser, auth(['atm', 'datm', 'ta', 'ec', 'fe', 'wm']), async (req, res) => {
	try {
		const {title, content} = req.body;
		const newsItem = await News.findOne({uriSlug: req.params.slug});
		if(newsItem.title !== title) {
			newsItem.title = title;
			newsItem.uriSlug = title.replace(/\s+/g, '-').toLowerCase().replace(/^-+|-+(?=-|$)/g, '').replace(/[^a-zA-Z0-9-_]/g, '') + '-' + Date.now().toString().slice(-5);
		}
		newsItem.content = content;
		await newsItem.save();
		await req.app.dossier.create({
			by: res.user.cid,
			affected: -1,
			action: `%b updated the news item *${newsItem.title}*.`
		});
	}
	catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}	

	return res.json(res.stdRes);
});

router.delete('/:slug', getUser, auth(['atm', 'datm', 'ta', 'ec', 'fe', 'wm']), async (req, res) =>{
	try {
		const newsItem = await News.findOne({uriSlug: req.params.slug});
		const status = await newsItem.delete();
		
		if(!status) {
			throw {
				code: 500,
				message: "Something went wrong, please try again"
			};
		}

		await req.app.dossier.create({
			by: res.user.cid,
			affected: -1,
			action: `%b deleted the news item *${newsItem.title}*.`
		});
	}
	catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}	

	return res.json(res.stdRes);
});

// router.get('/seed', async (req, res) => {
// 	await News.create({
// 		title: "Test 1",
// 		uriSlug: 'test-1',
// 		content: 'This is test content for the news system.',
// 		createdBy: '60089d338b76613ca9a0ea12'
// 	}, {
// 		title: "Test 2",
// 		uriSlug: 'test-2',
// 		content: 'This is test content number 2 for the news system.',
// 		createdBy: '60089d338b76613ca9a0ea12'
// 	});

// 	res.sendStatus(200);
// });

export default router;