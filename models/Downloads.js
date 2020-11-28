import m from 'mongoose';

const downloadSchema = new m.Schema({
	name: String,
	description: String,
	fileName: String,
	category: String,
	author: {
		type: m.Schema.Types.ObjectId, ref: 'User'
	}
}, {
	collection: "downloads",
	timestamps: true
});

export default m.model('downloads', downloadSchema);