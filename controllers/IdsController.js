import express from 'express';
import redis from '../config/redis.js';
const router = express.Router();

router.ws('/', ws => {
	redis.subscribe('PILOT:UPDATE');
	redis.on('message', (channel, message) => {
		switch(channel) {
			case "METAR:UPDATE":
				ws.send('metar');
				break;
			case "ATIS:UPDATE":
				ws.send('atis');
				break;
			case "PILOT:UPDATE":
				ws.send(message);
				break;
			default:
				ws.send('idk');
		}
		// ws.send(`Channel: ${channel} - Message: ${message}`);
	});
});

export default router;