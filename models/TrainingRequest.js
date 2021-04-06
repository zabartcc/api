import m from 'mongoose';
import softDelete from 'mongoose-delete';

const trainingRequestSchema = new m.Schema({
	studentCid: Number,
	instructorCid: Number,
	startTime: Date,
	endTime: Date,
	milestoneCode: String,
	remarks: String
}, {
	collection: "trainingRequests",
	timestamps: true
});

trainingRequestSchema.virtual('milestone', {
	ref: 'TrainingMilestone',
	localField: 'milestoneCode',
	foreignField: 'code',
	justOne: true
});

trainingRequestSchema.virtual('student', {
	ref: 'User',
	localField: 'studentCid',
	foreignField: 'cid',
	justOne: true
});

trainingRequestSchema.virtual('instructor', {
	ref: 'User',
	localField: 'instructorCid',
	foreignField: 'cid',
	justOne: true
});

trainingRequestSchema.plugin(softDelete, {
	deletedAt: true
});


export default m.model('TrainingRequest', trainingRequestSchema);