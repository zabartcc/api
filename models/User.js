import m from 'mongoose';
// import ControllerHours from './ControllerHours.js';
import softDelete from 'mongoose-delete';
import './Certification.js';
import './Role.js';

const userSchema = new m.Schema({
	cid: Number,
	fname: String,
	lname: String,
	email: String,
	rating: Number,
	oi: String,
	broadcast: Boolean,
	vis: Number,
	certifications: [{
		type: m.Schema.Types.ObjectId, ref: 'Certification'
	}],
	roles: [{
		type: m.Schema.Types.ObjectId, ref: 'Role'
	}]
}, {
	timestamps: true,
});

// userSchema.index({
//     '$**': 'text',
// });

userSchema.plugin(softDelete, {
	deletedAt: true
});

userSchema.virtual('isStaff').get(function() {
	return !!this.roles.length;
});

userSchema.virtual('isIns').get(function() {
	const search = ['atm', 'datm', 'ins', 'mtr'];
	return !!this.roles.filter(r => search.includes(r.code)).length;
});

userSchema.virtual('isMgt').get(function() {
	const search = ['atm', 'datm', 'ta', 'ec', 'wm', 'fe'];
	return !!this.roles.filter(r => search.includes(r.code)).length;
});

// userSchema.methods.getControllerHours = async function() {
// 	return ControllerHours.find({
// 		cid: this.cid
// 	}).lean();
// };

export default m.model('User', userSchema);