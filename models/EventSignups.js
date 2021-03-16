import m from 'mongoose';
import './User.js';

const signups = new m.Schema({
	cid: Number,
	requests: [{
		type: String
	}]
},{
	timestamps: true,
});

signups.virtual('user', {
	ref: 'User',
	localField: 'cid',
	foreignField: 'cid',
	justOne: true
})

export default signups;