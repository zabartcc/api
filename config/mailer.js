import nodemailer from 'nodemailer';
import neh from 'nodemailer-express-handlebars';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.resolve();

const transport = nodemailer.createTransport({
	host: process.env.EMAIL_SERVER,
	port: 587,
	auth: {
		user: process.env.EMAIL_USER,
		pass: process.env.EMAIL_PASSWORD
	},
});

transport.use('compile', neh({
	viewPath: __dirname + "/email",
	viewEngine: {
		extName: ".hbs",
		layoutsDir: __dirname + "/email",
		partialsDir: __dirname + "/email",
		defaultLayout: "main"
	},
	extName: ".hbs"
}));

export default transport;