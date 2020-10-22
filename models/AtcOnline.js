import zab from '../config/zab.js';
import m from 'mongoose';
import mlv from 'mongoose-lean-virtuals';

const atcOnlineSchema = new m.Schema({
	cid: Number,
	name: String,
	rating: Number,
	pos: String,
	timeStart: Number,
	atis: String,
	frequency: Number
}, {
	collection: "atcOnline"
});

atcOnlineSchema.virtual('ratingShort').get(function() {
	return zab.ratings[this.rating];
});

atcOnlineSchema.virtual('ratingLong').get(function() {
	return zab.ratingsLong[this.rating];
});

atcOnlineSchema.plugin(mlv);

export default m.model('AtcOnline', atcOnlineSchema);