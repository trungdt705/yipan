/** Checklist */
var mongoose = require('mongoose');
var Schema   = mongoose.Schema;

/**
 * Table Structure checks {
 *      ,owner      sponsor
 *      ,create     the starting time
 *      ,signgroup  Check in the object
 *      ,remark     Note
 *      ,isAccumulated   Is it a Accumulated test?
 *      ,numExpected    Design sample size
 *      ,numReal        The number of actual spot checks may not reach the design number if the cumulative number of checks may be the same as ensuring the number of individual spot checks
 *      ,detail: [Student object id]
 *  }
 * @type {Schema}
 */

/** Sampling the main document structure */
var CheckSchema = new Schema({
    owner: {type: mongoose.Schema.Types.ObjectId, ref: 'User'}
    ,create: {type: Date, default:Date.now()}
    ,signgroup: {type: mongoose.Schema.Types.ObjectId, ref: 'SignGroup'}
    ,remark: {type: String}
    ,isAccumulated: {type: Boolean, default:true}
    ,numExpected: {type:Number, default:0}
    ,numReal: {type:Number, default:0}
    ,detail:[{type: mongoose.Schema.Types.ObjectId, ref: 'User'}]
});

module.exports = mongoose.model('Check', CheckSchema);