import m from 'mongoose';

const configSchema = new m.Schema({
	withYou: Number,
}, {
	collection: "config"
});

export default m.model('Config', configSchema);