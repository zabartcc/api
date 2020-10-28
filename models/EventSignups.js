import m from 'mongoose';
import './User.js';

const signups = new m.Schema({
	user: {
		type: m.Schema.Types.ObjectId, ref: 'User'
	},
	preferences: [{
		type: String
	}]
},{
	timestamps: true,
});

export default signups;