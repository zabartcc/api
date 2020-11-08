import m from 'mongoose';
import './User.js';
import positions from './EventPositions.js';
import signups from './EventSignups.js';
import softDelete from 'mongoose-delete';

const eventSchema = new m.Schema({
	name: String,
	description: String,
	url: String, // for SEO reaons and because incremental counters in URLs SUCK!
	bannerUrl: String,
	eventStart: Date,
	eventEnd: Date,
	createdBy: {
		type: m.Schema.Types.ObjectId, ref: 'User' // EC, typically
	},
	positions: [positions], // what positions are open, and who has been assigned what?
	signups: [signups], // who has signed up?
	open: Boolean, // open for sign ups
	submitted: Boolean, // have emails etc. been sent out?

}, {
	timestamps: true,
});


eventSchema.plugin(softDelete, {
	deletedAt: true
});

export default m.model('Event', eventSchema);