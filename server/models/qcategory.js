/** Question Category Table
 * The chapter information of each question, such as "Chapter 3 White Box Test", is mainly used to identify which test questions to participate in the test when the test paper is written。
 * The current test questions are directly attached to a generic class. In the future, the generic tree structure can be designed. You can select chapters more flexibly when selecting questions.
 * Festival
 * */
var mongoose = require('mongoose');
var Schema   = mongoose.Schema;

/**
 * 
Table Structure qcategorys {
 *      name        Generic name
 *      remark      Note
 *  }
 * @type {Schema}
 */
var QcategorySchema = new Schema({
    name: {type: String, index: {unique: true}, required: true}
    ,remark: {type: String}
});

module.exports = mongoose.model('Qcategory', QcategorySchema);