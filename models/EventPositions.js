import m from 'mongoose';
import './User.js';

const positions = new m.Schema({
	pos: String,
	type: String,
	code: String,
	takenBy: Number
});

positions.virtual('user', {
	ref: 'User',
	localField: 'takenBy',
	foreignField: 'cid',
	justOne: true
})


export default positions;