import m from 'mongoose';
import softDelete from 'mongoose-delete';

const trainingSessionSchema = new m.Schema({
	student: {
		type: m.Schema.Types.ObjectId, ref: 'User'
	},
	instructor: {
		type: m.Schema.Types.ObjectId, ref: 'User'
	},
	milestone: {
		type: m.Schema.Types.ObjectId, ref: 'TrainingMilestone'
	},
	position: String,
	startTime: Date,
	endTime: Date,
	progress: Number,
	duration: Number,
	movements: Number,
	location: String,
	ots: String,
	soloGranted: Boolean,
	studentNotes: String,
	insNotes: String,
	noShow: Boolean,
	submitted: Boolean,
	synced: Boolean
}, {
	collection: "trainingSessions",
	timestamps: true
});

trainingSessionSchema.plugin(softDelete, {
	deletedAt: true
});


export default m.model('TrainingSession', trainingSessionSchema);