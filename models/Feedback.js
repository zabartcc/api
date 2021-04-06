import m from 'mongoose';
import softDelete from 'mongoose-delete';

const feedbackSchema = new m.Schema({
	name: String,
	email: String,
	submitter: Number,
	controllerCid: Number,
	rating: Number,
	position: String,
	comments: String,
	ip: String,
	anonymous: Boolean,
	approved: Boolean
}, {
	collection: "feedback",
	timestamps: true
});

feedbackSchema.plugin(softDelete, {
	deletedAt: true
});

feedbackSchema.virtual('controller', {
	ref: 'User',
	localField: 'controllerCid',
	foreignField: 'cid',
	justOne: true
});

export default m.model('feedback', feedbackSchema);