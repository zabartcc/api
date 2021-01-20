import m from 'mongoose';
import softDelete from 'mongoose-delete';

const trainingRequestSchema = new m.Schema({
	student: {
		type: m.Schema.Types.ObjectId, ref: 'User'
	},
	instructor: {
		type: m.Schema.Types.ObjectId, ref: 'User'
	},
	startTime: Date,
	endTime: Date,
	milestone: {
		type: m.Schema.Types.ObjectId, ref: 'TrainingMilestone'
	}
}, {
	collection: "trainingRequests",
	timestamps: true
});

trainingRequestSchema.plugin(softDelete, {
	deletedAt: true
});


export default m.model('TrainingRequest', trainingRequestSchema);