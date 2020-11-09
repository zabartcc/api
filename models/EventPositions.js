import m from 'mongoose';
import './User.js';

const positions = new m.Schema({
	pos: String,
	type: String,
	code: String,
	takenBy: {
		type: m.Schema.Types.ObjectId, ref: 'User'
	}
});

export default positions;