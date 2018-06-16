/**
 *
 * Used to locate the test paper query caused by the error of the test question, according to the given question number, query which test paper contains the question
 * Print all student information for easy manual bonus points.
 *
 * Created by Administrator on 2016/4/8.
 */
var fs           = require('fs');
var config = require('../../config');
var mongoose = require('mongoose');
mongoose.connect(config.database, {useMongoClient:true});
var Exam = require('../models/exam');
//This sentence is very important and needs to be used when associating
require('../models/user');


var fileName = './包含试题Q0000025-0的学生名单.txt';
Exam
    .find({'questions.questions.code':'Q0000025-0'})
    .select('config tester score point isSubmit')
    .populate('tester', 'name code')
    .exec(function(err,res){
    if (err) {
        console.log('Error find: ', err);
    } else {
        console.log('Found ', res.length ,' exams.');

        var json = [];
        for(var i in res){
            if(res[i].isSubmit)
                json.push(i+' '+ res[i]._id+ ' '+ res[i].config+ ' '+ res[i].score+ ' '+ res[i].point
                    + ' '+ res[i].tester.name+ ' '+ res[i].tester.code);
            else
                json.push(i+' '+ res[i]._id+ ' '+ res[i].config+ ' '+ res[i].score+ ' '+ res[i].point
                    + ' '+ res[i].tester.name+ ' '+ res[i].tester.code+ ' Unpaid');
        }
        fs.appendFile(fileName, json.join('\n'), function(err){
            if(err)
                console.log("Write file[" , fileName , "]failure " , err);
            else
                console.log("Write file[" , fileName , "]success. ");
        });
    }
});