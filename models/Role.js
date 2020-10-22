import m from 'mongoose';

const roleSchema = new m.Schema({
	code: String,
	order: Number,
	name: String,
	class: String
});

export default m.model('Role', roleSchema);