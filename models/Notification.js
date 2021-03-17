import m from 'mongoose';
import softDelete from 'mongoose-delete';

const notificationSchema = new m.Schema({
	recipient: Number,
	read: Boolean,
	title: String,
	content: String,
	link: String
}, {
	timestamps: true
});

notificationSchema.virtual('user', {
	ref: 'User',
	localField: 'recipient',
	foreignField: 'cid',
	justOne: true
});

notificationSchema.plugin(softDelete, {
	deletedAt: true
});


export default m.model('Notification', notificationSchema);