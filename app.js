// Core imports
import express from 'express';
import cookie from 'cookie-parser';
import cors from 'cors';
import env from 'dotenv';
import mongoose from 'mongoose';
import body from 'body-parser';
import ws from 'ws';
import Redis from 'ioredis';

// Route Controllers
import UserController from './controllers/UserController.js';
import ControllerController from './controllers/ControllerController.js';
import OnlineController from './controllers/OnlineController.js';
import EventController from './controllers/EventController.js';
import FileController from './controllers/FileController.js';
import FeedbackController from './controllers/FeedbackController.js';
// import IdsController from './controllers/IdsController.js';

env.config();

// Setup Express
const app = express();
// ws(app/*, null, {
// 	wsOptions: {
// 		clientTracking: true,
// 	}
// }*/);
app.use(cookie());
app.use(express.json());
app.use(body.json({limit: '50mb'}));
app.use(body.urlencoded({
	limit: '50mb',
	extended: true,
	parameterLimit: 50000
}));

const origins = process.env.CORS_ORIGIN.split('|');

app.use(cors({
	origin: origins,
	credentials: true,
}));

// app.use((req, res, next) => {
// 	console.log(req.headers.host);
// 	res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN);
// 	res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
// 	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
// 	res.setHeader('Access-Control-Allow-Credentials', true);
// 	next();
// });

// Connect to MongoDB
mongoose.set('toJSON', {virtuals: true});
mongoose.set('toObject', {virtuals: true});
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true, useFindAndModify: false });
const db = mongoose.connection;
db.once('open', () => console.log('Successfully connected to MongoDB'));

const redis = new Redis(process.env.REDIS_URI);

// const IdsController = express.Router();

// IdsController.ws('/', ws => {
// 	console.log(ws);
// 	sub.on('message', async (channel, message) => {
// 		switch(channel) {
// 			case "METAR:UPDATE":
// 				ws.send('metar');
// 				break;
// 			case "ATIS:UPDATE":
// 				ws.send('atis');
// 				break;
// 			case "PILOT:UPDATE":
// 				ws.send(JSON.stringify(await redis.hgetall(`PILOT:${message}`)));
// 				break;
// 			default:
// 				ws.send('idk');
// 		}
// 		// ws.send(`Channel: ${channel} - Message: ${message}`);
// 	});

// 	ws.on('close', () => {
// 		sub.unsubscribe('METAR:UPDATE', 'ATIS:UPDATE', 'PILOT:UPDATE');
// 	});
// });


app.use('/online', OnlineController);
app.use('/user', UserController);
app.use('/controller', ControllerController);
app.use('/event', EventController);
app.use('/file', FileController);
app.use('/feedback', FeedbackController);
// app.use('/ids', IdsController);


const expServer = app.listen('3000', () =>{
	console.log('Listening on port 3000');
});

const wsserver = new ws.Server({noServer: true});

expServer.on('upgrade', (req, soc, head) => {
	wsserver.handleUpgrade(req, soc, head, soc => {
		wsserver.emit('connection', soc, req);
	});
});

wsserver.on('connection', (ws, req) => {
	const sub = new Redis(process.env.REDIS_URI);
	switch(req.url) {
		case "/ids/aircraft": 
			sub.subscribe('PILOT:UPDATE', 'PILOT:DELETE');
			sub.on('message', async (channel, message) => {
				if(channel === "PILOT:UPDATE") {
					let res = await redis.hgetall(`PILOT:${message}`);
					res.type = 'update';
					ws.send(JSON.stringify(res));
				}
				if(channel === "PILOT:DELETE") {
					ws.send(JSON.stringify({
						type: 'delete',
						callsign: message
					}));
				}
			});
			break;
		default:
			return;

	}
	// if(req.url === '/ids') {
	// 	sub.on('message', async (channel, message) => {
	// 		switch(channel) {
	// 			case "METAR:UPDATE":
	// 				// ws.send('metar');
	// 				break;
	// 			case "ATIS:UPDATE":
	// 				// ws.send('atis');
	// 				break;
	// 			case "PILOT:UPDATE":
	// 				ws.send(JSON.stringify(await redis.hgetall(`PILOT:${message}`)));
	// 				break;
	// 			default:
	// 				ws.send('idk');
	// 		}
	// 	});
	// }
});