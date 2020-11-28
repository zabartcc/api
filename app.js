// Core imports
import express from 'express';
import cookie from 'cookie-parser';
import cors from 'cors';
import env from 'dotenv';
import mongoose from 'mongoose';
import body from 'body-parser';

// Route Controllers
import UserController from './controllers/UserController.js';
import ControllerController from './controllers/ControllerController.js';
import OnlineController from './controllers/OnlineController.js';
import EventController from './controllers/EventController.js';
import FileController from './controllers/FileController.js';

env.config();

// Setup Express
const app = express();
app.use(cookie());
app.use(express.json());
app.use(body.json());

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

app.use('/online', OnlineController);
app.use('/user', UserController);
app.use('/controller', ControllerController);
app.use('/event', EventController);
app.use('/file', FileController);


app.listen('3000', () =>{
	console.log('Listening on port 3000');
});