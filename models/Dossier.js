import m from 'mongoose';

const dossierSchema = new m.Schema({
	by: Number,
	affected: Number,
	action: String,
}, {
	collection: 'dossier',
	timestamps: true
});

dossierSchema.virtual('userBy', {
	ref: 'User',
	localField: 'by',
	foreignField: 'cid',
	justOne: true
});

dossierSchema.virtual('userAffected', {
	ref: 'User',
	localField: 'affected',
	foreignField: 'cid',
	justOne: true
});

export default m.model('dossier', dossierSchema);