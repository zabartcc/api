import m from 'mongoose';

const trainingMilestoneSchema = new m.Schema({
	code: String,
	name: String,
	rating: Number
});

export default m.model('TrainingMilestone', trainingMilestoneSchema, 'trainingMilestones');