var mongoose = require('mongoose');
var Schema   = mongoose.Schema;

/**
 * Define the table structure of the log user, path, method, date, parameters, url
 * @type {Schema}
 */
var LogSchema = new Schema({
    user: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    path: {type: String},
    method: {type: String},
    date: {type: Date},
    parameters: {type: String},
    url : {type: String}
});

LogSchema.pre('save',function(next){
    this.date = Date.now();
    next();
});

module.exports = mongoose.model('Log', LogSchema);