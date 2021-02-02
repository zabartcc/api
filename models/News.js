import m from 'mongoose';
import softDelete from 'mongoose-delete';
import './User.js';

const newsSchema = new m.Schema({
	title: String,
	content: String,
	uriSlug: String,
	createdBy: {
		type: m.Schema.Types.ObjectId, ref: 'User'
	},
}, {
	collection: "news",
	timestamps: true
});

newsSchema.plugin(softDelete, {
	deletedAt: true
});

export default m.model('News', newsSchema);