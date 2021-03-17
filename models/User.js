import m from 'mongoose';
import mlv from 'mongoose-lean-virtuals';
// import ControllerHours from './ControllerHours.js';
import softDelete from 'mongoose-delete';
import './Certification.js';
import './Role.js';
import './Absence.js';
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
	homeFacility: String,
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
	certCodes: [],
	roleCodes: [],
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
	return this.roleCodes.some(r => search.includes(r));
});

userSchema.virtual('isSenior').get(function() {
	const search = ['atm', 'datm', 'ta'];
	return this.roleCodes.some(r => search.includes(r));
});

userSchema.virtual('isStaff').get(function() {
	const search = ['atm', 'datm', 'ta', 'ec', 'wm', 'fe'];
	return this.roleCodes.some(r => search.includes(r));
});

userSchema.virtual('isIns').get(function() {
	const search = ['atm', 'datm', 'ta', 'ins', 'mtr'];
	return this.roleCodes.some(r => search.includes(r));
});

userSchema.virtual('ratingShort').get(function() {
	return zab.ratings[this.rating];
});

userSchema.virtual('ratingLong').get(function() {
	return zab.ratingsLong[this.rating];
});

userSchema.virtual('roles', {
	ref: 'Role',
	localField: 'roleCodes',
	foreignField: 'code'
});

userSchema.virtual('certifications', {
	ref: 'Certification',
	localField: 'certCodes',
	foreignField: 'code'
});

userSchema.virtual('absence', {
	ref: 'Absence',
	localField: 'cid',
	foreignField: 'controller'
});

export default m.model('User', userSchema);