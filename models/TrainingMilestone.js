import m from 'mongoose';

const trainingMilestoneSchema = new m.Schema({
	code: String,
	name: String,
	rating: Number, // Legacy field, replaced by "availableAtRatings".
	certCode: String, // Legacy field, replaced by "hiddenWhenControllerHasTierOne".
	availableAtRatings: Array,
	hiddenWhenControllerHasTierOne: Boolean
});

export default m.model('TrainingMilestone', trainingMilestoneSchema, 'trainingMilestones');