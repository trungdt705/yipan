/**
 * Test the mongoose aggregate call
 * Created by Administrator on 2015/9/15.
 *
 * Aggregate statement used to query group statistics by generics and types
 db.questions.aggregate([{$group:{_id:{category:"$category",type:"$type"},count:{$sum:1}}}]);
 */
var config = require('../../config');
var mongoose = require('mongoose');
mongoose.connect(config.database, {useMongoClient:true});
var Question = require('../models/question');

Question.aggregate([{$group:{_id:{category:"$category",type:"$type"},count:{$sum:1}}}]).exec(function(err,res) {
    if (err) {
        console.log('Error find: ', err);
    } else {
        for(var i in res){
            console.log(JSON.stringify(res[i]));
        }
    }
});