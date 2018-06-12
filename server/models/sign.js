/** Check in table */
var mongoose = require('mongoose');
var Schema   = mongoose.Schema;

/**
 * Table Structure signs {
 *      name        The name of the check-in is usually the name of the check-in object group
 *      ,owner      sponsor
 *      ,create     the starting time
 *      ,signgroup  Check in the object
 *      ,remark     Note
 *      ,isClosed   Is it closed
 *      ,numExpected    Number of participants = Actual signing number + Unusual number
 *      ,numReal    Actual number of people
 *      ,numException   The number of abnormal people mainly refers to the number of people signing and asking for leave.
 *      ,history:   {//Record the time of opening, closing and other actions
 *          date:   time
 *          name:   User who performed the action
 *          type:   The name of the action
 *          remark: Note
 *      }
 *      ,detail: {
 *          name    Student object id
 *          date    Check-in time, or record the time of last modification
 *          status  In the check-in state, the default is no check-in. After the check-in, it becomes the check-in status. It can also be marked by the teacher as the signing and leave status.
 *          remark  Note
 *      }
 *  }
 * @type {Schema}
 */

/** Operation history subdocument structure */
var HistorySchema = new Schema(
    {
        name: {type: mongoose.Schema.Types.ObjectId, ref: 'User'}
        ,date: {type: Date, default:Date.now()}
        ,type: {type: String, required: true}
        ,remark: {type: String}
    }
);

/** Signature subdocument structure */
var DetailSchema = new Schema(
    {
        name: {type: mongoose.Schema.Types.ObjectId, ref: 'User'}
        ,date: {type: Date, default:Date.now()}
        ,status: {type: String, default:'未签到'}
        ,ip: {type: String}
        ,remark: {type: String}
    }
);

/** Check in the main document structure */
var SignSchema = new Schema({
    name: {type: String, required: true}
    ,owner: {type: mongoose.Schema.Types.ObjectId, ref: 'User'}
    ,create: {type: Date, default:Date.now()}
    ,signgroup: {type: mongoose.Schema.Types.ObjectId, ref: 'SignGroup'}
    ,remark: {type: String}
    ,isClosed: {type: Boolean, default:false}
    ,numExpected: {type:Number, default:0}
    ,numReal: {type:Number, default:0}
    ,numException: {type:Number, default:0}
    ,history:[HistorySchema]
    ,detail:[DetailSchema]
});

module.exports = mongoose.model('Sign', SignSchema);