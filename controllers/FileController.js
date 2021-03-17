import e from 'express';
const router = e.Router();
import aws from 'aws-sdk';
import multer from 'multer';
import fs from 'fs/promises';
import Downloads from '../models/Download.js';
import Documents from '../models/Document.js';
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
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.put('/downloads/:id', multer({storage: multer.memoryStorage(), limits: { fileSize: 25000000 }}).single("download"), getUser, auth(['atm', 'datm', 'ta', 'fe']), async (req, res) => {
	try {
		if(!req.file) { // no updated file provided
			await Downloads.findByIdAndUpdate(req.params.id, {
				name: req.body.name,
				description: req.body.description,
				category: req.body.category
			});
		} else { // new updates file provided
			/*const download = await Downloads.findById(req.params.id).select('fileName').lean();
			const fileName = download.fileName;
			minioClient.removeObject("downloads", fileName, (error) => {
				if (error) {
					console.log(error);
					return res.sendStatus(500);
				}
			});
			minioClient.putObject("downloads", req.file.originalname, req.file.buffer, {}, (error) => {
				if(error) {
					console.log(error);
					return res.sendStatus(500);
				} else {*/
					await Downloads.findByIdAndUpdate(req.params.id, {
						name: req.body.name,
						description: req.body.description,
						category: req.body.category,
						fileName: req.file.originalname
					})
				/*}
			});*/
		}
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.delete('/downloads/:id', getUser, auth(['atm', 'datm', 'ta', 'fe']), async (req, res) => {
	try {
		await Downloads.findByIdAndDelete(req.params.id).lean();
		
		/*const fileName = download.fileName;
		minioClient.removeObject("downloads", fileName, (error) => {
			if(error) {
				console.log(error);
				return res.status(500).send('Something went wrong, please try again');
			} else {
				return res.sendStatus(200);
			}
		});*/
	} catch(e) {
		res.stdRes.std_res = e;
	}

	return res.json(res.stdRes);
});

// Documents
router.get('/documents', async ({res}) => {
	try {
		const documents = await Documents.find({deletedAt: null}).select('-content').sort({category: "asc"}).lean();
		res.stdRes.data = documents;
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.get('/documents/:slug', async (req, res) => {
	try {
		const document = await Documents.findOne({slug: req.params.slug, deletedAt: null}).lean();
		res.stdRes.data = document;
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

export default router;