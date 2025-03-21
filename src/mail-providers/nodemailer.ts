import nodemailer from 'nodemailer';
import hbs from 'nodemailer-express-handlebars';
import { ENV } from '../constants/env-variables';
import { join } from 'path';

export const transporter = nodemailer.createTransport({
	service: 'gmail',
	secure: false,
	auth: {
		user: 'tylerjusfly1@gmail.com',
		pass: ENV.EMAIL_SECRET,
	},
});

// verify connection configuration
transporter.verify(function (error, success) {
	if (error) {
		console.log('Email server connection error! ' + error);
	} else {
		console.log('Email server is ready to take our messages! ' + success);
	}
});

const options = {
	viewEngine: {
		extname: '.hbs',
		defaultLayout: '',
		layoutsDir: join(__dirname, './htmltemplates'),
	},
	viewPath: join(__dirname, './htmltemplates'),
	extName: '.hbs',
};

transporter.use('compile', hbs(options));


