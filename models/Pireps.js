import m from 'mongoose';

const pirepSchema = new m.Schema({
	reportTime: Date,
	location: String,
	aircraft: String,
	flightLevel: String,
	skyCond: String,
	turbulence: String,
	icing: String,
	vis: String,
	temp: String,
	wind: String,
	urgent: Boolean,
	raw: String,
	manual: Boolean
}, {
	collection: "pirep"
});

export default m.model('pirep', pirepSchema);