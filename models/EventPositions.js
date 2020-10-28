import m from 'mongoose';
import './User.js';

const positions = new m.Schema({
        pos: String,
		type: String,
		major: Boolean,
		minRating: Number,
        taken: {
            type: m.Schema.Types.ObjectId, ref: 'User'
        }
});

export default positions;