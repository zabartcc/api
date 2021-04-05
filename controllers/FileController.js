import e from 'express';
const router = e.Router();
import aws from 'aws-sdk';
import multer from 'multer';
import fs from 'fs/promises';
import Downloads from '../models/Download.js';
import Document from '../models/Document.js';
import getUser from '../middleware/getUser.js';
import auth from '../middleware/auth.js';

const s3 = new aws.S3({
	endpoint: new aws.Endpoint('sfo3.digitaloceanspaces.com'),
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const upload = multer({
	storage: multer.diskStorage({
		destination: (req, file, cb) => {
			cb(null, '/tmp');
		},
		filename: (req, file, cb) => {
			cb(null, `${Date.now()}-${file.originalname}`);
		}
	})
})

// Downloads
router.get('/downloads', async ({res}) => {
	try {
		const downloads = await Downloads.find({deletedAt: null}).sort({category: "asc"}).lean();
		res.stdRes.data = downloads;
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.get('/downloads/:id', async (req, res) => {
	try {
		const download = await Downloads.findById(req.params.id).lean();
		res.stdRes.data = download;
	} catch(e) {
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
});

router.post('/downloads', getUser, auth(['atm', 'datm', 'ta', 'fe']), upload.single('download'), async (req, res) => {
	try {
		if(!req.body.category) {
			throw {
				code: 400,
				message: 'No category was selected.'
			}
		}
		if(req.file.size > (20 * 1024 * 1024)) {	// 20MiB
			throw {
				code: 400,
				message: 'File too large.'
			}
		}
		const tmpFile = await fs.readFile(req.file.path);
		await s3.putObject({
			Bucket: 'zabartcc/downloads',
			Key: req.file.filename,
			Body: tmpFile,
			ContentType: req.file.mimetype,
			ACL: 'public-read',
		}).promise();

		await Downloads.create({
			name: req.body.name,
			description: req.body.description,
			fileName: req.file.filename,
			category: req.body.category,
			author: req.body.author
		});

		
		await req.app.dossier.create({
			by: res.user.cid,
			affected: -1,
			action: `%b created the file *${req.body.name}*.`
		});
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.put('/downloads/:id', upload.single('download'), getUser, auth(['atm', 'datm', 'ta', 'fe']), async (req, res) => {
	try {
		let download;
		if(!req.file) { // no updated file provided
			download = await Downloads.findByIdAndUpdate(req.params.id, {
				name: req.body.name,
				description: req.body.description,
				category: req.body.category
			});
		} else {
			download = await Downloads.findByIdAndUpdate(req.params.id, {
				name: req.body.name,
				description: req.body.description,
				category: req.body.category,
				fileName: req.file.filename
			})
		}
		await req.app.dossier.create({
			by: res.user.cid,
			affected: -1,
			action: `%b updated the file *${req.body.name}*.`
		});
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.delete('/downloads/:id', getUser, auth(['atm', 'datm', 'ta', 'fe']), async (req, res) => {
	try {
		const download = await Downloads.findByIdAndDelete(req.params.id).lean();
		await req.app.dossier.create({
			by: res.user.cid,
			affected: -1,
			action: `%b deleted the file *${download.name}*.`
		});
	} catch(e) {
		res.stdRes.std_res = e;
	}

	return res.json(res.stdRes);
});

// Documents
router.get('/documents', async ({res}) => {
	try {
		const documents = await Document.find({deletedAt: null}).select('-content').sort({category: "asc"}).sort({name: 'asc'}).lean();
		res.stdRes.data = documents;
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.get('/documents/:slug', async (req, res) => {
	try {
		const document = await Document.findOne({slug: req.params.slug, deletedAt: null}).lean();
		res.stdRes.data = document;
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.post('/documents', getUser, auth(['atm', 'datm', 'ta', 'fe']), async (req, res) => {
	try {
		const {name, category, description, content} = req.body;
		if(!category) {
			throw {
				code: 400,
				message: 'No category was selected.'
			}
		}

		if(!content) {
			throw {
				code: 400,
				message: 'No content was included.'
			}
		}

		const slug = name.replace(/\s+/g, '-').toLowerCase().replace(/^-+|-+(?=-|$)/g, '').replace(/[^a-zA-Z0-9-_]/g, '') + '-' + Date.now().toString().slice(-5);

		const create = await Document.create({
			name,
			category,
			description,
			content,
			slug,
			author: res.user.cid
		});

		await req.app.dossier.create({
			by: res.user.cid,
			affected: -1,
			action: `%b created the document *${req.body.name}*.`
		});
		
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.put('/documents/:slug', getUser, auth(['atm', 'datm', 'ta', 'fe']), async (req, res) => {
	try {
		const document = await Document.findOne({slug: req.params.slug});
		const {name, category, description, content} = req.body;
		if(document.name !== name) {
			document.name = name;
			document.slug = name.replace(/\s+/g, '-').toLowerCase().replace(/^-+|-+(?=-|$)/g, '').replace(/[^a-zA-Z0-9-_]/g, '') + '-' + Date.now().toString().slice(-5);
		}
		document.category = category;
		document.description = description;
		document.content = content;

		await document.save();

		await req.app.dossier.create({
			by: res.user.cid,
			affected: -1,
			action: `%b updated the document *${document.name}*.`
		});
	} catch(e) {
		res.stdRes.std_res = e;
	}

	return res.json(res.stdRes);
})

router.delete('/documents/:id', getUser, auth(['atm', 'datm', 'ta', 'fe']), async (req, res) => {
	try {
		const doc = await Document.findByIdAndDelete(req.params.id);
		await req.app.dossier.create({
			by: res.user.cid,
			affected: -1,
			action: `%b deleted the document *${doc.name}*.`
		});
	} catch(e) {
		res.stdRes.std_res = e;
	}

	return res.json(res.stdRes);
});

export default router;