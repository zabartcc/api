import m from 'mongoose';
// import ControllerHours from './ControllerHours.js';
import softDelete from 'mongoose-delete';
import './Position.js';
import './User.js';

const eventSchema = new m.Schema({
	name: String,
	description: String,
	bannerUrl: String,
	eventStart: Date,
	eventEnd: Date,
	createdBy: {
		type: m.Schema.Types.ObjectId, ref: 'User'
	},
	positions: [{
		type: m.Schema.Types.ObjectId, ref: 'Position'
	}],
	open: Boolean, // open for sign ups
	submitted: Boolean, // have emails etc. been sent out?

}, {
	timestamps: true,
});

eventSchema.plugin(softDelete, {
	deletedAt: true
});

export default m.model('Event', eventSchema);