// Core imports
import express from 'express';
import cookie from 'cookie-parser';
import cors from 'cors';
import env from 'dotenv';
import mongoose from 'mongoose';
import body from 'body-parser';
import Redis from 'ioredis';
import aws from 'aws-sdk';

// Route Controllers
import UserController from './controllers/UserController.js';
import ControllerController from './controllers/ControllerController.js';
import OnlineController from './controllers/OnlineController.js';
import NewsController from './controllers/NewsController.js';
import EventController from './controllers/EventController.js';
import FileController from './controllers/FileController.js';
import FeedbackController from './controllers/FeedbackController.js';
import IdsController from './controllers/IdsController.js';
import TrainingController from './controllers/TrainingController.js';

// Global Dossier Model
import Dossier from './models/Dossier.js';

import getUser from './middleware/getUser.js';

env.config();

// Setup Express
const app = express();
app.use((req, res, next) => {
	res.stdRes = {
		ret_det: {
			code: 200,
			message: '',
		}, 
		data: {}
	};

	next();
});
app.use(cookie());
app.use(express.json());
app.use(body.json({limit: '50mb'}));
app.use(body.urlencoded({
	limit: '50mb',
	extended: true,
	parameterLimit: 50000
}));

app.redis = new Redis(process.env.REDIS_URI);

app.redis.on('error', err => { throw new Error(`Failed to connect to Redis: ${err}`); });

const origins = process.env.CORS_ORIGIN.split('|');

app.use(cors({
	origin: origins,
	credentials: true,
}));

app.use((req, res, next) => {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
	res.setHeader('Access-Control-Allow-Credentials', true);
	next();
});


app.s3 = new aws.S3({
	endpoint: new aws.Endpoint('sfo3.digitaloceanspaces.com'),
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

app.dossier = Dossier;

// Connect to MongoDB
mongoose.set('toJSON', {virtuals: true});
mongoose.set('toObject', {virtuals: true});
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true, useFindAndModify: false });
const db = mongoose.connection;
db.once('open', () => console.log('Successfully connected to MongoDB'));

app.use('/online', OnlineController);
app.use('/user', UserController);
app.use('/controller', ControllerController);
app.use('/news', NewsController);
app.use('/event', EventController);
app.use('/file', FileController);
app.use('/feedback', FeedbackController);
app.use('/ids', IdsController);
app.use('/training', TrainingController);
app.get('/gimme', getUser, async (req, res) => {
	if(!res.user) {
		return res.send('You need to log in first.');
	} else {
		if(![999230, 1112502, 1419950, 1382891, 1277323, 1427985, 1167179, 1358609, 1149612, 1037247, 1461101, 995625].includes(res.user.cid)) {
			return res.send('You are not on the beta team.')
		}
		if(res.user.roleCodes.includes('wm')) {
			return res.send('You already have the Web Team role.')
		} else {
			res.user.roleCodes.push('wm');
			await res.user.save();
			return res.send('Web Team re-added');
		}
	}
})

app.listen('3000', () =>{
	console.log('Listening on port 3000');
});