import m from 'mongoose';

const documentSchema = new m.Schema({
	name: String,
	description: String,
	slug: String,
	category: String,
	author: {
		type: m.Schema.Types.ObjectId, ref: 'User'
	},
	content: String
}, {
	collection: "documents",
	timestamps: true
});

export default m.model('documents', documentSchema);