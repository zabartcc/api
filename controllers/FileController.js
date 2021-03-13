import e from 'express';
const router = e.Router();
import multer from 'multer';
import minio from 'minio';
import Downloads from '../models/Download.js';
import Documents from '../models/Document.js';
import {isStaff} from '../middleware/isStaff.js';

const minioClient = new minio.Client({
	endPoint: 'cdn.zabartcc.org',
	port: 443,
	useSSL: true,
	accessKey: process.env.MINIO_ACCESS_KEY,
	secretKey: process.env.MINIO_SECRET_KEY
});

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

router.post('/downloads/new', multer({storage: multer.memoryStorage(), limits: { fileSize: 25000000 }}).single("download"), isStaff, async (req, res) => {
	try {
	/*minioClient.putObject("downloads", req.file.originalname, req.file.buffer, {}, (error) => {
		if(error) {
			console.log(error);
			return res.status(500).send('Something went wrong, please try again.');
		}
	});*/

		await Downloads.create({
			name: req.body.name,
			description: req.body.description,
			fileName: req.file.originalname,
			category: req.body.category,
			author: req.body.author
		});
	} catch(e) {
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.put('/downloads/:id', multer({storage: multer.memoryStorage(), limits: { fileSize: 25000000 }}).single("download"), isStaff, async (req, res) => {
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

router.delete('/downloads/:id', isStaff, async (req, res) => {
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