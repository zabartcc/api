import m from 'mongoose';

const atisOnlineSchema = new m.Schema({
	cid: Number,
	airport: String,
	callsign: String,
	code: String,
	text: String
}, {
	collection: "atisOnline"
});

export default m.model('AtisOnline', atisOnlineSchema);