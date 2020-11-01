import m from 'mongoose';

const certificationSchema = new m.Schema({
	code: String,
	order: Number,
	name: String,
	class: String,
	facility: String
});

export default m.model('Certification', certificationSchema);