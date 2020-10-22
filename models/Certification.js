import m from 'mongoose';

const certificationSchema = new m.Schema({
	code: String,
	order: Number,
	name: String,
	class: String
});

export default m.model('Certification', certificationSchema);