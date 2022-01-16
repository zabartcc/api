import express from 'express';
import microAuth from '../middleware/microAuth.js';
import axios from 'axios';
const router = express.Router();

import User from '../models/User.js';
import Config from '../models/Config.js';
import getUser from '../middleware/getUser.js';

router.get('/users', microAuth, async (req, res) => {
	try {
		const users = await User.find({discordInfo: {$ne: null}})
			.select('fname lname cid discordInfo roleCodes oi rating member vis');

		res.stdRes.data = users;
	}
	catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
})

router.get('/withyou', microAuth, async (req, res) => {
	try {
		const withYou = await Config.findOne({}).select('withYou').lean();

		res.stdRes.data = withYou;
	}
	catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.post('/withyou', microAuth, async (req, res) => {
	try {
		const withYou = await Config.findOne({}).select('withYou');
		withYou.withYou++;
		await withYou.save();
	}
	catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.delete('/withyou', microAuth, async (req, res) => {
	try {
		const withYou = await Config.findOne({}).select('withYou');
		withYou.withYou--;
		await withYou.save();
	}
	catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.post('/pfr', getUser, async (req, res) => {
	try {
		if(!res.user) {
			throw {
				code: 401,
				message: "Not logged in."
			};
		}

		const { name, callsign, student, position, deficiencies, comments } = req.body;

		const discordWebhook = {
			content: null,
			embeds: [
				{
					title: "TANMAC PFR",
					description: `A new TANMAC PFR has been submitted by **${name}**.`,
					color: 2132305,
					fields: [
						{
							name: "Pilot Callsign",
							value: callsign,
							inline: true
						},
						{
							name: "Student Name",
							value: student,
							inline: true
						},
						{
							name: "Position",
							value: position,
							inline: true
						},
						{
							name: "Deficiencies Noted",
							value: deficiencies,
						},
					],
					author: {
						name: "Albuquerque ARTCC",
						icon_url: "https://zabartcc.sfo3.digitaloceanspaces.com/images/zab_logo.png"
					},
					footer: {
						text: "This PFR was submitted via the ZAB Website.",
						icon_url: "https://zabartcc.sfo3.digitaloceanspaces.com/images/zab_logo.png"
					},
					timestamp: new Date(),
				}
			]
		};

		if(comments) {
			discordWebhook.embeds[0].fields.push({
				name: "Other Notes",
				value: comments,
			});
		}

		await axios.post(`https://discord.com/api/webhooks/932108922695847988/${process.env.DISCORD_PFR_WEBHOOK_TOKEN}`, discordWebhook);
	}
	catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
})
	
export default router;