// Core imports
import express from 'express';
import cookie from 'cookie-parser';
import cors from 'cors';
import env from 'dotenv';
import mongoose from 'mongoose';
import body from 'body-parser';
import Redis from 'ioredis';
import aws from 'aws-sdk';
import mysql from 'mysql2/promise'

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
import TrainingSession from './models/TrainingSession.js';

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

app.get('/syncTraining', async (req, res) => {
	const conn = await mysql.createConnection({
		host: 'skyharbor.zabartcc.org',
		user: 'webmaster',
		password: process.env.MYSQL_PASSWORD,
		database: 'zab',
		timezone: 'UTC'
	});

	const [rows] = await conn.execute('SELECT * FROM training');
	
	for(const row of rows) {
		if(!row.deleted_at && row.ins_id && row.notes) {
			const milestoneCodes = ["", "GC1", "GC2", "GC3", "GC4", "LC1", "LC2", "LC3", "LC4", "LC5", "LC6", "AD1", "AD2", "AD3", "AD4", "AD5", "AD6", "AD7", "AD8", "AD9", "EN1", "EN2", "EN3", "GT1"];
			const positionCodes = ['', 'PHX_DEL', 'PHX_GND', 'PHX_TWR', 'PHX_APP', 'ABQ_CTR'];
			const positionReduction = {
				GC1: 'FLG_GND',
				GC2: 'ABQ_GND',
				GC3: 'PHX_GND',
				GC4: 'PHX_GND',
				LC1: 'ABQ_TWR',
				LC2: 'ABQ_TWR',
				LC3: 'ABQ_TWR',
				LC4: 'ABQ_TWR',
				LC5: 'PHX_TWR',
				LC6: 'PHX_TWR',
				AD1: 'ABQ_APP',
				AD2: 'ABQ_APP',
				AD3: 'ABQ_APP',
				AD4: 'ABQ_APP',
				AD5: 'PHX_APP',
				AD6: 'PHX_APP',
				AD7: 'PHX_APP',
				AD8: 'PHX_APP',
				AD9: 'PHX_APP',
				EN1: 'ABQ_CTR',
				EN2: 'ABQ_CTR',
				EN3: 'ABQ_CTR',
				GT1: 'XXX_DEL',
			}
			const theMilestone = (row.milestone_id === -1) ? 'GT1' : milestoneCodes[row.milestone_id];
			const thePosition = (row.position === -1) ? positionReduction[milestoneCodes[row.milestone_id]] : positionCodes[row.position];
			const delta = Math.abs(new Date(row.time_end) - new Date(row.time_start)) / 1000;
			const hours = Math.floor(delta / 3600);
			const minutes = Math.floor(delta / 60) % 60;

			const duration = `${('00' + hours).slice(-2)}:${('00' + minutes).slice(-2)} ${row.time_start}`;

			await TrainingSession.create({
				studentCid: row.user_id,
				instructorCid: row.ins_id,
				milestoneCode: theMilestone,
				position: thePosition,
				startTime: row.time_start,
				endTime: row.time_end,
				progress: 4,
				duration,
				location: 1,
				studentNotes: row.notes ? row.notes.replace(/\<br \/\>/g, '').replace(/\<br\>/g, '\n') : '',
				submitted: true,
				synced: false
			})
		}
	}

	res.sendStatus(200)
})

app.listen('3000', () =>{
	console.log('Listening on port 3000');
});