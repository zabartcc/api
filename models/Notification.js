import m from 'mongoose';
import softDelete from 'mongoose-delete';

const notificationSchema = new m.Schema({
	recipient: {
		type: m.Schema.Types.ObjectId, ref: 'User'
	},
	read: Boolean,
	title: String,
	content: String,
	link: String
}, {
	timestamps: true
});

notificationSchema.plugin(softDelete, {
	deletedAt: true
});


export default m.model('Notification', notificationSchema);