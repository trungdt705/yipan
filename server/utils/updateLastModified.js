/**
 * After adding the Last Modified field, you need to batch reset the LastModified values ​​of all current File records.
 * The method is that each record looks for the most recent record in the history operation record that involved the modification, replacing the LastModified time with its time.
 * Which contains operations upload|replace|create|rename|cut|copy|move|paste
 * Created by Administrator on 2016/3/16.
 */

var mongoose = require('mongoose');
var config = require('../../config');       // read configurations
var Schema = mongoose.Schema;
mongoose.connect(config.database, {useMongoClient:true});

var File = require('../models/file');

//Display all information of the current database
var criteria = {};

File.find(criteria).exec(function(err,res){
    if(err){
        console.log('Error find: ', err);
    } else {
        for(var i in res){

            //Update the lastModified field
            if(res[i].history.length>0) {
                for(var j in res[i].history){
                    if('upload|replace|create|rename|cut|copy|move|paste'.indexOf(res[i].history[j].type)>-1){
                        res[i].lastModified = res[i].history[j].date;
                        res[i].save(function (err) {
                            if (err) {
                                console.log('Error save with id=', res[i]._id, ': ', err);
                            }
                        });
                        break;
                    }
                }


            }
        }
    }
});
