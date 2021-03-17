import m from 'mongoose';
import softDelete from 'mongoose-delete';

const absenceSchema = new m.Schema({
	controller: Number,
	expirationDate: Date,
	reason: String
}, {
	collection: "absence",
	timestamps: true
});

absenceSchema.virtual('user', {
	ref: 'User',
	localField: 'controller',
	foreignField: 'cid',
	justOne: true
});

absenceSchema.plugin(softDelete, {
	deletedAt: true
});

export default m.model('Absence', absenceSchema);
