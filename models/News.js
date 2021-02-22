import m from 'mongoose';
import softDelete from 'mongoose-delete';
import './User.js';

const newsSchema = new m.Schema({
	title: String,
	content: String,
	uriSlug: String,
	createdBy: Number
}, {
	collection: "news",
	timestamps: true
});

newsSchema.virtual('user', {
	ref: 'User',
	localField: 'createdBy',
	foreignField: 'cid',
	justOne: true
});

newsSchema.plugin(softDelete, {
	deletedAt: true
});

export default m.model('News', newsSchema);