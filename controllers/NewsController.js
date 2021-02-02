import e from 'express';
const router = e.Router();
import {isStaff} from '../middleware/isStaff.js';
import News from '../models/News.js';

router.get('/', async (req, res) => {
	const page = parseInt(req.query.page, 10);
	const limit = parseInt(req.query.limit, 10);

	const amount = await News.countDocuments({deleted: false});
	const news = await News.find({deleted: false}).sort({createdAt: 'desc'}).skip(limit * (page - 1)).limit(limit).populate('createdBy', ['fname', 'lname']).lean();
	res.stdRes.amount = amount;
	res.stdRes.data = news;
	return res.json(res.stdRes);
});

router.post('/', isStaff, async (req, res) => {
	try {
		if(!req.body || !req.body.title || !req.body.content) {
			throw {
				code: 400,
				message: "One or more form fields are missing."
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
				message: "Something went wrong, please try again."
			};
		}

	}
	catch(e) {
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
});

router.get('/:slug', async (req, res) =>{
	const newsItem = await News
		.findOne({uriSlug: req.params.slug})
		.populate('createdBy', ['fname', 'lname'])
		.lean();

	res.stdRes.data = newsItem;
	return res.json(res.stdRes);
});

router.put('/:slug', isStaff, async (req, res) => {
	try {
		const {title, content} = req.body;
		const newsItem = await News.findOne({uriSlug: req.params.slug});
		if(newsItem.title !== title) {
			newsItem.title = title;
			newsItem.uriSlug = title.replace(/\s+/g, '-').toLowerCase().replace(/^-+|-+(?=-|$)/g, '').replace(/[^a-zA-Z0-9-_]/g, '') + '-' + Date.now().toString().slice(-5);
		}
		newsItem.content = content;
		await newsItem.save();
	}
	catch(e) {
		res.stdRes.ret_det = e;
	}	

	return res.json(res.stdRes);
});

router.delete('/:slug', isStaff, async (req, res) =>{
	try {
		const newsItem = await News.findOne({uriSlug: req.params.slug});
		const status = await newsItem.delete();
		
		if(!status) {
			throw {
				code: 500,
				message: "Something went wrong, please try again."
			};
		}
	}
	catch(e) {
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