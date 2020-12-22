import m from 'mongoose';

const pirepSchema = new m.Schema({
	reportTime: Date,
	aircraft: String,
	flightLevel: String,
	skyCond: String,
	turbulence: String,
	icing: String,
	vis: String,
	temp: String,
	windDir: String,
	windSpd: String,
	urgent: Boolean,
	raw: String,
	manual: Boolean
}, {
	collection: "pirep"
});

export default m.model('pirep', pirepSchema);