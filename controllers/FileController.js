import e from 'express';
const router = e.Router();
import multer from 'multer';
import minio from 'minio';
import Downloads from '../models/Downloads.js';
import Documents from '../models/Documents.js';
import isStaff from '../middleware/isStaff.js';

const minioClient = new minio.Client({
	endPoint: 'cdn.zabartcc.org',
	port: 443,
	useSSL: true,
	accessKey: process.env.MINIO_ACCESS_KEY,
	secretKey: process.env.MINIO_SECRET_KEY
});

// Downloads
router.get('/downloads', async ({res}) => {
	const downloads = await Downloads.find({deletedAt: null}).sort({category: "asc"}).lean();
	return res.json(downloads);
});

router.get('/downloads/:id', async (req, res) => {
	const download = await Downloads.findById(req.params.id).lean();
	return res.json(download);
});

router.post('/downloads/new', multer({storage: multer.memoryStorage(), limits: { fileSize: 25000000 }}).single("download"), isStaff, async (req, res) => {
	minioClient.putObject("downloads", req.file.originalname, req.file.buffer, {}, (error) => {
		if(error) {
			console.log(error);
			return res.status(500).send('Something went wrong, please try again.');
		}
	});

	Downloads.create({
		name: req.body.name,
		description: req.body.description,
		fileName: req.file.originalname,
		category: req.body.category,
		author: req.body.author
	}).then(() => {
		return res.sendStatus(200);
	}).catch((err) => {
		console.log(err);
		return res.sendStatus(500);
	});
});

router.put('/downloads/:id', multer({storage: multer.memoryStorage(), limits: { fileSize: 25000000 }}).single("download"), isStaff, async (req, res) => {
	if(!req.file) { // no updated file provided
		Downloads.findByIdAndUpdate(req.params.id, {
			name: req.body.name,
			description: req.body.description,
			category: req.body.category
		}).then(() => {
			return res.sendStatus(200);
		}).catch((err) => {
			console.log(err);
			return res.sendStatus(500);
		});
	} else { // new updates file provided
		const download = await Downloads.findById(req.params.id).select('fileName').lean();
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
				return res.status(500).send('Something went wrong, please try again.');
			} else {
				Downloads.findByIdAndUpdate(req.params.id, {
					name: req.body.name,
					description: req.body.description,
					category: req.body.category,
					fileName: req.file.originalname
				}).then(() => {
					return res.sendStatus(200);
				}).catch((err) => {
					console.log(err);
					return res.sendStatus(500);
				});
			}
		});
	}
});

router.delete('/downloads/:id', isStaff, async (req, res) => {
	const download = await Downloads.findByIdAndDelete(req.params.id).lean();
	const fileName = download.fileName;

	minioClient.removeObject("downloads", fileName, (error) => {
		if(error) {
			console.log(error);
			return res.status(500).send('Something went wrong, please try again');
		} else {
			return res.sendStatus(200);
		}
	});
});

// Documents
router.get('/documents', async ({res}) => {
	const documents = await Documents.find({deletedAt: null}).select('-content').sort({category: "asc"}).lean();
	return res.json(documents);
});

router.get('/documents/:slug', async (req, res) => {
	const document = await Documents.findOne({slug: req.params.slug, deletedAt: null}).lean();
	if(document.length === 0) {
		return res.sendStatus(404);
	} else {
		return res.json(document);
	}
});

export default router;