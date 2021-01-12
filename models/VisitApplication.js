import m from 'mongoose';
import softDelete from 'mongoose-delete';

const visitApplicationSchema = new m.Schema({
	cid: Number,
	fname: String,
	lname: String,
	rating: String,
	email: String,
	home: String,
	reason: String,
	acceptedAt: Date
}, {
	collection: "visitApplications",
	timestamps: true
});

visitApplicationSchema.plugin(softDelete, {
	deletedAt: true
});


export default m.model('VisitApplication', visitApplicationSchema);