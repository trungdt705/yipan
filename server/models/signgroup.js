/** 
Check in the object table */
var mongoose = require('mongoose');
var Schema   = mongoose.Schema;

/**
 * Table Structure signgroups {
 *      name        The name of the object group
 *      ,pattern    The object group is generally distinguished by the student's prefix. Remember its regular expression here.
 *      ,remark     Note
 *  }
 * @type {Schema}
 */
var SigngroupSchema = new Schema({
    name: {type: String, index: {unique: true}, required: true}
    ,pattern: {type: String, required: true}
    ,remark: {type: String}
});

module.exports = mongoose.model('SignGroup', SigngroupSchema);