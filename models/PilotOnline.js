import m from 'mongoose';

const pilotOnlineSchema = new m.Schema({
	cid: Number,
	name: String,
	callsign: String,
	aircraft: String,
	dep: String,
	dest: String,
	lat: Number,
	lng: Number,
	heading: Number,
	route: String,
	remarks: String
}, {
	collection: "pilotsOnline"
});

export default m.model('PilotOnline', pilotOnlineSchema);