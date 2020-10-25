import m from 'mongoose';

const positionSchema = new m.Schema({
	name: String,
	callsign: String,
	type: String,
	rating: String,
	major: Boolean,
	frequency: String
});

export default m.model('Position', positionSchema);