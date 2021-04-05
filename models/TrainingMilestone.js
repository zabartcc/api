import m from 'mongoose';

const trainingMilestoneSchema = new m.Schema({
	code: String,
	name: String,
	rating: Number,
	certCode: String
});

export default m.model('TrainingMilestone', trainingMilestoneSchema, 'trainingMilestones');