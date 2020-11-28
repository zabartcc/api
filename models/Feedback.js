import m from 'mongoose';
import softDelete from 'mongoose-delete';

const feedbackSchema = new m.Schema({
	fname: String,
	lname: String,
	email: String,
	submitter: Number,
	controller: {
		type: m.Schema.Types.ObjectId, ref: 'User'
	},
	rating: Number,
	comments: String,
	anonymous: Boolean,
	approved: Boolean
}, {
	collection: "feedback",
	timestamps: true
});

feedbackSchema.plugin(softDelete, {
	deletedAt: true
});


export default m.model('feedback', feedbackSchema);