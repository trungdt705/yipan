var mongoose = require('mongoose');
var Schema   = mongoose.Schema;

/**
 * Define system variables, mainly for recording one-time values
 * For example, the current largest number
 * @codetype    The number type indicates whether it is an exam, sheet, or question
 * @maxNo       Record the next largest number. Note that it is not the current maximum number of the system. If you want to use
 *              Can directly take the largest number to the new type number, and then increase one number for the next use
 * @type {Schema}
 */
var SystemSchema = new Schema({
    codeType: {type: String, required: true, index: {unique: true}}
    ,maxNo : {type: Number, default:1}
});

module.exports = mongoose.model('System', SystemSchema);