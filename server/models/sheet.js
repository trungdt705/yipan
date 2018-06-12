/** Group Volume Table
 * The group volume is a record of how the test questions form a set, does not contain specific questions, but only a configuration case
 * The question that the team can answer is: how many sections of the software test mid-term exam should be taken, how many questions each section has, and what type of questions
 * */
var mongoose = require('mongoose');
var Schema   = mongoose.Schema;

/**
 * Table Structure sheet {
 *      name        Test paper name
 *      num         The total number of questions, which is currently the sum of the number of topics included in the statistics
 *      remark      Note
 *      detail      Test item details
 *          category    From which chapter
 *          type        Question type
 *          num         Number of questions
 *  }
 * @type {Schema}
 */
var DetailSchema = new Schema({
    type: {type: String, required: true}
    ,category: {type: mongoose.Schema.Types.ObjectId, ref: 'Qcategory', required: true}
    ,num: {type: Number, required: true}
});

var SheetSchema = new Schema({
    name: {type: String, required: true}
    ,code: {type: String, required: true, index:{unique:true}}
    ,lastModified: {type: Date}
    ,num: {type: Number}
    ,remark: {type: String}
    ,detail: [DetailSchema]
});

/** Total number of automatic cumulative test questions */
SheetSchema.pre('save', function (next) {
    var sheet = this;
    if (sheet.isModified('detail')){
        var num = 0;
        for(var i=0;i<sheet.detail.length;i++){
            num += sheet.detail[i].num;
        }
        sheet.num = num;
    }
    console.log(sheet)
    next();
});

module.exports = mongoose.model('Sheet', SheetSchema);