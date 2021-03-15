import m from 'mongoose';
import './User.js';
import EventPositions from './EventPositions.js';
import EventSignups from './EventSignups.js';
import softDelete from 'mongoose-delete';

const eventSchema = new m.Schema({
	name: String,
	description: String,
	url: String, // for SEO reaons and because incremental counters in URLs SUCK!
	bannerUrl: String,
	eventStart: Date,
	eventEnd: Date,
	createdBy: Number,
	positions: [EventPositions], // what positions are open, and who has been assigned what?
	signups: [EventSignups], // who has signed up?
	open: Boolean, // open for sign ups
	submitted: Boolean, // have emails etc. been sent out?

}, {
	timestamps: true,
});

eventSchema.virtual('user', {
	ref: 'User',
	localField: 'createdAt',
	foreignField: 'cid'
})

eventSchema.plugin(softDelete, {
	deletedAt: true
});

export default m.model('Event', eventSchema);