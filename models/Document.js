import m from 'mongoose';

const documentSchema = new m.Schema({
	name: String,
	category: String,
	description: String,
	content: String,
	slug: String,
	author: Number,
	type: String,
	fileName: String
}, {
	collection: "documents",
	timestamps: true
});

documentSchema.virtual('user', {
	ref: 'User',
	localField: 'author',
	foreignField: 'cid',
	justOne: true
});

export default m.model('documents', documentSchema);