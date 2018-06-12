/**
 * To test the pipeline functionality of Mongoose's query execution, test the query function of the Exam data collection.
 * Separate populate config and tester two fields
 * Created by Administrator on 2016/7/5.
 */

var mongoose = require('mongoose');
var config = require('../../config');       // read configurations
mongoose.connect(config.database, {useMongoClient:true});

var Exam = require('../models/exam');
require('../models/examconfig');
require('../models/user');

var query = Exam.findOne({isCorrected:true});
query = query.select('config tester isCorrected');
query = query.populate('config', 'name canReview');
query = query.populate('tester', 'name code');

query.exec(function(err,data){
    if(err) console.log('error ', err);
    else console.log('done ', data);
});