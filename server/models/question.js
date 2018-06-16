/** Question Question Table
 * Record the structure of each test question, due to the need to consider a variety of questions, each question contains an array of sub-documents, is a variety of styles of the question, need to be randomly selected when generating the test paper。
 * */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

/**
 * Table Structure qcategorys {
 *      desc            Exam questions example, due to the existence of a variety of questions, this is just an example, specific questions in the form field
 *      category        GenericID
 *      point           Score, default 1
 *      type            Type, currently supported Single selection, multiple selection, follow-up can be added to the judgment, fill in the blank four types
 *      remark          Note
 *
 *      numForm         Test item number
 *      form            Question style array
 *          desc        Title section
 *          ans         Answer array
 *              desc    Answer description
 *              isValid is it right or not
 *  }
 * @type {Schema}
 */
var AnswerSchema = new Schema({
    desc: { type: String, required: true }
    , isValid: { type: Boolean }
});

var FormSchema = new Schema({
    desc: { type: String, required: true }
    , images: [{ type: String }]
    , ans: [AnswerSchema]
});

var QuestionSchema = new Schema({
    desc: { type: String }
    , code: { type: String, required: true, index: { unique: true } }
    , lastModified: { type: Date }
    , type: { type: String, index: true, required: true }
    , category: { type: mongoose.Schema.Types.ObjectId, ref: 'Qcategory', index: true }
    , remark: { type: String }
    , point: { type: Number, default: 1, required: true }
    , form: [FormSchema]
    , numForm: { type: Number }
});

/** Automatically record the first question from the array of question patterns in the main document, so that you can see the contents of the questions immediately when you search. */
QuestionSchema.pre('save', function (next) {
    var question = this;
    if (question.isModified('form')) {
        if (question.form && question.form.length > 0) {
            question.desc = question.form[0].desc;
            question.numForm = question.form.length;
        } else {
            question.desc = null;
            question.numForm = 0;
        }
    }

    next();
});


module.exports = mongoose.model('Question', QuestionSchema);