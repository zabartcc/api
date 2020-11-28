import e from 'express';
const router = e.Router();
import multer from 'multer';
import minio from 'minio';
import Downloads from '../models/Downloads.js';
import isStaff from '../middleware/isStaff.js';

const minioClient = new minio.Client({
	endPoint: 'cdn.zabartcc.org',
	port: 443,
	useSSL: true,
	accessKey: process.env.MINIO_ACCESS_KEY,
	secretKey: process.env.MINIO_SECRET_KEY
});

router.get('/downloads', async ({res}) => {
	const downloads = await Downloads.find({deletedAt: null}).sort({category: "asc"}).lean();
	return res.json(downloads);
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

router.delete('/downloads/:id', isStaff, async(req, res) => {
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

export default router;