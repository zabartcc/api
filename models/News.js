import m from 'mongoose';
import './User.js';

const newsSchema = new m.Schema({
	title: String,
	content: String,
	uriSlug: String,
	createdBy: {
		type: m.Schema.Types.ObjectId, ref: 'User'
	},
}, {
	timestamps: true,
});

export default m.model('News', newsSchema);