import m from 'mongoose';
import softDelete from 'mongoose-delete';

const trainingSessionSchema = new m.Schema({
	studentCid: Number,
	instructorCid: Number,
	milestoneCode: String,
	position: String,
	startTime: Date,
	endTime: Date,
	progress: Number,
	duration: String,
	movements: Number,
	location: Number,
	ots: Number,
	studentNotes: String,
	insNotes: String,
	submitted: Boolean,
	synced: Boolean
}, {
	collection: "trainingSessions",
	timestamps: true
});

trainingSessionSchema.virtual('milestone', {
	ref: 'TrainingMilestone',
	localField: 'milestoneCode',
	foreignField: 'code',
	justOne: true
});


trainingSessionSchema.virtual('student', {
	ref: 'User',
	localField: 'studentCid',
	foreignField: 'cid',
	justOne: true
});

trainingSessionSchema.virtual('instructor', {
	ref: 'User',
	localField: 'instructorCid',
	foreignField: 'cid',
	justOne: true
});

trainingSessionSchema.plugin(softDelete, {
	deletedAt: true
});


export default m.model('TrainingSession', trainingSessionSchema);