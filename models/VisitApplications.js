import m from 'mongoose';

const visitApplicationsSchema = new m.Schema({
	cid: Number,
	fname: String,
	lname: String,
	rating: String,
	email: String,
	home: String,
	reason: String,
	submittedAt: Date,
	acceptedBy: {
		type: m.Schema.Types.ObjectId, ref: 'User'
	},
	acceptedAt: Date
}, {
	collection: "visitApplications"
});

export default m.model('VisitApplications', visitApplicationsSchema);