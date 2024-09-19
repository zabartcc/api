// Core imports
import express from 'express';
import * as Sentry from "@sentry/node";
import * as Tracing from '@sentry/tracing';
import cookie from 'cookie-parser';
import cors from 'cors';
import env from 'dotenv';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import aws from 'aws-sdk';
import activityHelper from './helpers/controllerActivityHelper.js';

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
import DiscordController from './controllers/DiscordController.js';
import StatsController from './controllers/StatsController.js';

// Global Dossier Model
import Dossier from './models/Dossier.js';

env.config();

// Setup Express
const app = express();

if(process.env.NODE_ENV === 'production') {
	Sentry.init({
		dsn: "https://1ef975d497c5404f8aadd6b97cd48424@o885721.ingest.sentry.io/5837848",  
		integrations: [
			new Sentry.Integrations.Http({ tracing: true }),
			new Tracing.Integrations.Express({ 
				app, 
			}),
		],
		tracesSampleRate: 0.5,
	});

	app.use(Sentry.Handlers.requestHandler());
	app.use(Sentry.Handlers.tracingHandler());
} else {
	app.Sentry = {
		captureException(e) {
			console.log(e);
		},
		captureMessage(m) {
			console.log(m);
		}
	};
}

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
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({
	limit: '50mb',
	extended: true,
	parameterLimit: 50000
}));

app.redis = new Redis(process.env.REDIS_URI);

app.redis.on('error', err => { throw new Error(`Failed to connect to Redis: ${err}`); });
app.redis.on('connect', () => console.log('Successfully connected to Redis'));

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
mongoose.connect(process.env.MONGO_URI);
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
app.use('/discord', DiscordController);
app.use('/stats', StatsController);

// Uncomment to activate activity emails for controllers. Reset DB activity date fields before activating.
// Disabled per the ATM 9/19/24.
// activityHelper.registerControllerActivityChecking();

if(process.env.NODE_ENV === 'production') app.use(Sentry.Handlers.errorHandler());

app.listen('3000', () =>{
	console.log('Listening on port 3000');
});