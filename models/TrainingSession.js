import m from 'mongoose';
import softDelete from 'mongoose-delete';

const trainingSessionSchema = new m.Schema({
	student: {
		type: m.Schema.Types.ObjectId, ref: 'User'
	},
	instructor: {
		type: m.Schema.Types.ObjectId, ref: 'User'
	},
	position: String,
	progress: Number,
	duration: Number,
	movements: Number,
	location: String,
	ots: String,
	studentNotes: String,
	insNotes: String,
	noShow: Boolean
}, {
	collection: "trainingSessions",
	timestamps: true
});

trainingSessionSchema.plugin(softDelete, {
	deletedAt: true
});


export default m.model('TrainingSession', trainingSessionSchema);