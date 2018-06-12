/**
 * Importing Json format questions
 *
 * The jsonfile plugin is used here, but the file format doesn't know how to set it to be recognized by it.
 * First use jsonfile to export a template file, and then copy the content to the template file, you can identify。
 *
 * Created by Administrator on 2016/4/6.
 */
//var filename = 'D:/MEAN-workspace/my/YiPan/singleLess.json';
//var filename = 'D:/MEAN-workspace/my/YiPan/data.json';
var dir = 'D:/yuyi/Lecture/软件测试/2016SS/mongo_import/formatted/';
//var filenames = ['singleLess'];
var filenames = ['single', 'multi' ,'fill'];
//var filenames = ['single', 'singleLess', 'multi' ,'multiLess' ,'fill'];

var jsonfile = require('jsonfile');
var util = require('util');
var async        = require('async');

//jsonfile.spaces = 4;
//
//var file = './data.json'
//var obj = {name: 'JP', dat: '炅立'}
//
//// json file has four space indenting now
//jsonfile.writeFile(file, obj, 'UTF8', function (err) {
//    console.error(err)
//});

var index = 0;
var len = filenames.length;
var filename;
//转换机
var qLib = require('./questionConvert.js');

async.whilst(
    function(){
        return index<len;
    },function(cb){
        filename = dir + filenames[index] + '.json';
        index ++;

        jsonfile.readFile(filename, 'UTF8', function(err, obj) {
            if(err)
                cb(err);
            else {
                console.log('--------------------------------------------');
                console.log('--- Read successfully ', filename, ' ---');
                qLib.convert(obj);
                qLib.output(filename + '.formatted.json');
                console.dir(JSON.stringify(qLib.json[0]));
                console.log('--------------------------------------------');
                cb();
            }
        });
    },function(error){
        if(error){
            console.log('Error by reading ', filename, '\t', error);
        }else
            console.log('Done');
    }
);
