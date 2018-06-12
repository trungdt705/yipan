/**
 * Some of the data imported from Excel may have spaces and line breaks before and after, and these symbols are removed uniformly.
 * Created by Administrator on 2016/3/16.
 */

var mongoose = require('mongoose');
var config = require('../../config');       // read configurations
mongoose.connect(config.database, {useMongoClient:true});

var User = require('../models/user.js');

//Find all users
User.find({}).exec(function(err,res){
    if(err){
        console.log('Error find: ', err);
    } else {
        var count = 0;
        var codes = [];
        for(var i in res){
            //Check the user's code
            var code = res[i].code.replace(/(\n|\r|(\r\n)|(\u0085)|(\u2028)|(\u2029))/g, '').trim();
            //If the code changes, there is a line break or space symbol, you need to save it again
            if(code != res[i].code) {
                //res[i].code = code;
                //res[i].save(function (err) {
                //    if (err) {
                //        console.log('Error save with id=', res[i]._id, ': ', err);
                //    }else{
                //        console.log('saved one');
                //    }
                //});
                count ++;
                codes.push(code);
            }
        }
        console.log('found incorrect codes: ', count);
        console.log(JSON.stringify(codes));
    }
});
