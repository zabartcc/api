import nodemailer from 'nodemailer';
import neh from 'nodemailer-express-handlebars';
import path from 'path';

const __dirname = path.resolve();

const transport = nodemailer.createTransport({
	host: "smtp.mailtrap.io",
	port: 2525,
	auth: {
		user: 'cfff2961799567',
		pass: 'e299da1099563f'
	}
});

transport.use('compile', neh({
	viewPath: __dirname+"/email",
	viewEngine: {
		extName: ".hbs",
		layoutsDir: __dirname+"/email",
		partialsDir: __dirname+"/email",
		defaultLayout: "main"
	},
	extName: ".hbs"
}));

export default transport;