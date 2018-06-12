/** Examination configuration object table
 * The test configuration is to define which test paper to use, test date and time, reference personnel and other information
 * */
var mongoose = require('mongoose');
var Schema   = mongoose.Schema;

/**
 * Table Structure examconfigs {
 *      name        Examination name
 *      sheet       Test paper ID
 *      canReview   Whether you can rewind, see the reference answer
 *      autoCorrect Whether to automatically determine the volume, if it is not determined automatically, manual or batch determination is required
 *      isFull      Whether it is a test roll or a roll, each type of test question will produce a question when measuring the roll.
 *      isGenerated Whether a test paper has been generated or not. After the test is defined, a long process of generating test papers is also required.
 *                 Changes to the test paper all result in the need to regenerate the test paper. This is only used to mark whether the test paper has been generated.
 *      dateGenerated   Generate timestamp for test paper
 *      isPublic    Can decide whether students are visible or not
 *      dateBegin   Examination officially announced examination start time
 *      minAhead    The time allowed to obtain the test paper in advance, the start time of the test release - the number of minutes in advance is the time the test taker can obtain the test paper, but also the decision "not started"
 *                  It is also the condition of the "exam" status. The time allowed in advance is in the range of [0,20].
 *      dateBeginAhead  The sum of the above two variables, that is, the time to really begin to enter the exam
 *      dateEnd     The official end date of the exam is the condition that determines whether the exam can submit an answer.
 *
 *      The student’s ability to take the exam depends on the following three conditions:
 *          isPublic, isGenerated，The status of the exam is in the exam (ie, whether the time required to request the exam is between [dateBegin-minAhead, dateEnd])
 *
 *      pattern     Reference student's student ID matching string
 *      remark      Note
 *      numTemplate Template sets
 *  }
 * @type {Schema}
 */
var ExamConfigSchema = new Schema({
    name: {type: String, required: true}
    ,remark: {type: String}
    ,sheet: {type: mongoose.Schema.Types.ObjectId, ref: 'Sheet', required: true}
    ,canReview: {type: Boolean, default: false}
    ,autoCorrect: {type: Boolean, default: false}
    ,isFull: {type: Boolean, default: false}
    ,isGenerated: {type: Boolean, default: false}
    ,isPublic: {type: Boolean, default: false}
    ,dateBegin: {type: Date}
    ,dateBeginAhead: {type: Date}
    ,dateEnd: {type: Date}
    ,dateGenerated: {type: Date}
    ,datePublic: {type: Date}
    ,minAhead: {type: Number, default: 0}
    ,code: {type: String, required: true, index:{unique:true}}
    ,lastModified: {type: Date}
    ,ipPattern: {type: String}
    ,ipPatternB: {type: String}
    ,pattern: {type: String}
    ,numTemplate: {type: Number}
});

/**
 * Preprocessing before saving
 *  */
ExamConfigSchema.pre('save', function (next) {
    var exam = this;
    //Once the test paper definition or template set number is modified, the test paper needs to be regenerated.
    if (exam.isModified('sheet') || exam.isModified('numTemplate')){
        exam.isGenerated = false;
    }
    //Once you have modified the number of minutes to start or advance to the exam, you need to recalculate the time that you can actually enter the exam.
    if (exam.isModified('minAhead') || exam.isModified('dateBegin')){
        var begin = new Date(exam.dateBegin);
        if(!isNaN(exam.minAhead))
            begin.setMinutes(begin.getMinutes() - exam.minAhead);
        exam.dateBeginAhead = begin;
    }
    next();
});

module.exports = mongoose.model('ExamConfig', ExamConfigSchema);