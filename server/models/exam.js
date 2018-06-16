/** Test paper object table
 * The exam paper is a table that defines the specific content of each student's exam paper. It contains details of the question. It should be multiple times afterwards.
 * Fixed results, but also can record student's submitted answers, reference answers, test scores and other information.
 * */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

/**
 * For the description of qid, the qid here is only an identifier of the comparison answer, and it cannot directly correspond to the Question object because of the possibility of multiple styles.
 * So the structure of qid is question id + '-' + formIndex
 * If you need to go back to the original question, you need to deal with it again
 * Table Structure exams {
 *      config      Cấu hình kiểm tra ID
 *      tester      Người tham chiếu ID
 *
 *      questions   Nội dung câu hỏi
 *          qid     Số ID câu hỏi
 *          code    Số câu hỏi + chỉ mục kiểu
 *          type    Loại câu hỏi
 *          desc    Mô tả
 *          point   Điểm
 *          ans     Câu trả lời tùy chọn được cung cấp
 *
 *      ansExpect   Câu trả lời tham khảo
 *          qid     Số ID câu hỏi
 *          ansIndex    Giá trị chỉ mục câu trả lời
 *
 *      ansSubmit   Gửi câu trả lời
 *          qid     Số ID câu hỏi
 *          ansIndex    Giá trị chỉ mục câu trả lời
 *
 *      isSubmit    Câu trả lời đã được gửi chưa?
 *      dateCorrect Ngày kết án
 *      isCorrect   Has it been sentenced
 *      score       Điểm
 *  }
 * @type {Schema}
 */
var AnsSchema = new Schema({
    qid: { type: String, required: true }
    //qid: {type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true}
    , ans: [{ type: Number }]
});
var QueSchema = new Schema({
    qid: { type: String, required: true }
    , code: { type: String, required: true }
    , point: { type: Number, required: true }
    , desc: { type: String, required: true }
    , images: [String]
    , ans: [String]
});

var TypeSchema = new Schema({
    type: { type: String, required: true }
    , questions: [QueSchema]
});
var ExamSchema = new Schema({
    config: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamConfig', required: true }
    , tester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
    , isCorrected: { type: Boolean, default: false }
    , dateCorrect: { type: Date, default: null }
    , score: { type: Number, default: 0 }
    , point: { type: Number, default: 0 }
    , isSubmit: { type: Boolean, default: false }
    , submitIP: { type: String, default: null }
    , isRead: { type: Boolean, default: false }
    , readIP: { type: String, default: null }
    , dateRead: { type: Date, default: null }
    , dateSubmit: { type: Date, default: null }
    , dateGenerated: { type: Date, default: null }

    , questions: [TypeSchema]
    , ansExpect: [AnsSchema]
    , ansSubmit: [AnsSchema]
});

/**
 * Add a method to the structure
 * The judgement is the process of comparing the reference answer with the user’s submitted answer.
 * Proceed as follows:
 *  1.  Trước tiên, lưu câu trả lời đã gửi của người dùng và câu trả lời tham chiếu vào cấu trúc dữ liệu của đối tượng để tìm kiếm dễ dàng
 *  2.  Traverse mọi câu hỏi, nếu cả hai đều có câu trả lời thì
 *  3.   Nếu đó là một lựa chọn duy nhất so sánh trực tiếp phần tử đầu tiên của hai mảng câu trả lời, nếu bằng với điểm số của điểm câu hỏi tương ứng
 *  4.  Nếu có nhiều lựa chọn, số lượng nhiều lựa chọn và ít lựa chọn hơn sẽ được tính, và số điểm sẽ được khấu trừ, nói chung, tổng số bốn câu hỏi sẽ được tính, và nhiều lựa chọn và ít lựa chọn hơn sẽ bị trừ 25%.
 * @returns {*}
 */
ExamSchema.methods.getScore = function () {
    var exam = this;
    if (!exam.ansSubmit || exam.ansSubmit.length < 1) return 0;
    if (!exam.ansExpect || exam.ansExpect.length < 1) return 0;

    //Reorganize submit answers and reference answers
    var submit = {};
    for (var i = 0; i < exam.ansSubmit.length; i++) {
        submit[exam.ansSubmit[i].qid] = exam.ansSubmit[i].ans;
    }
    var expected = {};
    for (var i = 0; i < exam.ansExpect.length; i++) {
        expected[exam.ansExpect[i].qid] = exam.ansExpect[i].ans;
    }

    //Traverse every test question
    var score = 0;
    var question;
    var type;
    //For each type
    for (var t = 0; t < exam.questions.length; t++) {
        type = exam.questions[t].type;
        //Traverse all questions of this type
        for (var i = 0; i < exam.questions[t].questions.length; i++) {
            question = exam.questions[t].questions[i];

            //Get two answer arrays
            var anse = expected[question.qid];
            var anss = submit[question.qid];
            if (!anss || !anse) continue;

            if (type == 'SINGLE') {
                //Multiple choice questions directly compare whether the first element of two arrays is equal
                if (anss.length > 0 && anse.length > 0) {
                    if (anss[0] == anse[0])
                        score += question.point;
                }
            } else if (type == 'MULTIPLE') {
                //Traverse every submitted answer and count the number of multiple choice answers
                var invalidAnsSubmit = 0;
                for (var j = 0; j < anss.length; j++) {
                    if (anse.indexOf(anss[j]) < 0)
                        invalidAnsSubmit++;
                }
                /**
                 * Missing the number of correct answers = Number of correct answers - Number of correct answers submitted
                 *                      = Number of correct answers - (Total number of submitted answers - Number of incorrect answers submitted)
                 *                      = Number of correct answers - Total number of submitted answers + Number of incorrect answers submitted
                 *                      = number of correct answers + number of multiple answers - total number of answers submitted
                 * @type {number}
                 */
                var validAnsMissing = anse.length + invalidAnsSubmit - anss.length;

                //Multi-selection score formula = Total score - (Number of multiple answers + Less number of answers)/4
                score += question.point * (4 - validAnsMissing - invalidAnsSubmit) / 4;
            }
        }
    }

    return score;
};

module.exports = mongoose.model('Exam', ExamSchema);