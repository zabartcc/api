import m from 'mongoose';

const controllerHoursSchema = new m.Schema({
	cid: Number,
	timeStart: Date,
	timeEnd: Date,
	position: String
}, {
	collection: "controllerHours"
});

controllerHoursSchema.virtual('user', {
	ref: 'User',
	localField: 'cid',
	foreignField: 'cid',
	justOne: true
});

export default m.model('ControllerHours', controllerHoursSchema);