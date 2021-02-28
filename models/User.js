import m from 'mongoose';
import mlv from 'mongoose-lean-virtuals';
// import ControllerHours from './ControllerHours.js';
import softDelete from 'mongoose-delete';
import './Certification.js';
import './Role.js';
import './TrainingMilestone.js';

import zab from '../config/zab.js';

const userSchema = new m.Schema({
	cid: Number,
	fname: String,
	lname: String,
	email: String,
	rating: Number,
	oi: String,
	broadcast: Boolean,
	member: Boolean,
	vis: Boolean,
	image: {
		custom: Boolean,
		filename: String	
	},
	discordInfo: {
		clientId: String,
		accessToken: String,
		refreshToken: String,
		tokenType: String,
		expires: Date,
	},
	idsToken: String,
	certifications: [{
		type: m.Schema.Types.ObjectId, ref: 'Certification'
	}],
	roles: [{
		type: m.Schema.Types.ObjectId, ref: 'Role'
	}],
	trainingMilestones: [{
		type: m.Schema.Types.ObjectId, ref: 'TrainingMilestone'
	}]
}, {
	timestamps: true,
});
userSchema.plugin(softDelete, {
	deletedAt: true
});

userSchema.plugin(mlv);

userSchema.virtual('isMem').get(function() {
	return !!this.member;
});

userSchema.virtual('isMgt').get(function() {
	const search = ['atm', 'datm'];
	return this.roles ? !!this.roles.filter(r => search.includes(r.code)).length : false;
});

userSchema.virtual('isSenior').get(function() {
	const search = ['atm', 'datm', 'ta'];
	return this.roles ? !!this.roles.filter(r => search.includes(r.code)).length : false;
});

userSchema.virtual('isStaff').get(function() {
	const search = ['atm', 'datm', 'ta', 'ec', 'wm', 'fe'];
	return this.roles ? !!this.roles.filter(r => search.includes(r.code)).length : false;
});

userSchema.virtual('isIns').get(function() {
	const search = ['atm', 'datm', 'ta', 'ins', 'mtr'];
	return this.roles ? !!this.roles.filter(r => search.includes(r.code)).length : false;
});

userSchema.virtual('ratingShort').get(function() {
	return zab.ratings[this.rating];
});

userSchema.virtual('ratingLong').get(function() {
	return zab.ratingsLong[this.rating];
});

// userSchema.methods.getControllerHours = async function() {
// 	return ControllerHours.find({
// 		cid: this.cid
// 	}).lean();
// };

export default m.model('User', userSchema);