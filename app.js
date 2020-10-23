// Core imports
import express from 'express';
import cookie from 'cookie-parser';
import cors from 'cors';
import env from 'dotenv';
import mongoose from 'mongoose';
import body from 'body-parser';

// Controllers
// import StaticController from './controllers/StaticController.js';
import UserController from './controllers/UserController.js';
import ControllerController from './controllers/ControllerController.js';
import OnlineController from './controllers/OnlineController.js';
// import HelperController from './controllers/HelperController.js';
// import ControllerHoursController from './controllers/ControllerHoursController.js';
// import AjaxController from './controllers/AjaxController.js';

// (async () => {
// 	syncRoster();
// })();

// Setup Express
const app = express();
app.use(cookie());
app.use(express.json());

app.use(body.json());

app.use(cors({
	origin: 'http://localhost:8080',
	credentials: true,
}));

app.use(({res, next}) => {
	res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8080');
	res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
	res.setHeader('Access-Control-Allow-Credentials', true);
	next();
});

// Connect to MongoDB
mongoose.set('toJSON', {virtuals: true});
mongoose.set('toObject', {virtuals: true});
mongoose.connect('mongodb://localhost:27017/zab', { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.once('open', () => console.log('Successfully connected to MongoDB'));

env.config();

app.use('/online', OnlineController);
app.use('/user', UserController);
app.use('/controller', ControllerController);


app.listen('3000', () =>{
	console.log('Listening on port 3000');
});