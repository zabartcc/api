import m from 'mongoose';

const pilotOnlineSchema = new m.Schema({
	cid: Number,
	name: String,
	callsign: String,
	aircraft: String,
	dep: String,
	dest: String,
	code: String,
	lat: Number,
	lng: Number,
	altitude: Number,
	heading: Number,
	speed: Number,
	planned_cruise: String,
	route: String,
	remarks: String
}, {
	collection: "pilotsOnline"
});

export default m.model('PilotOnline', pilotOnlineSchema);