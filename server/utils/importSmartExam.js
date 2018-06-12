/**
 * Conversion function written to import test text exported from SmartExam
 * The export format is:
 *
 * //[Parent Question Classification]: Question Classification/Algorithm and C Language Programming/Chapter 1 Overview of C Language Programming/Chapter 1 Overview of C Language Programming
   [Question Classification]:

    1.The following statement is incorrect（       ）
    A.A C source program can consist of one or more functions
    B.A C source program must contain a main function
    C.The basic unit of a C program is a function
    D.In a C program, the comment description can only be after a statement
    Question number:E18525
    answer:D
    Question type: single choice question
 The law is: each question begins with the classification of the questions, starting with a continuous number and adding a point，
 Then there are four candidate answers starting with ABCD. There is an answer after the number of the test paper, and the question type.
 *
 * The conversion goal is:
 * {
        "type": "Single selection"                     //The last line of question type gets from
        ,"category": "Chapter III Static Test"     //The last/after string in the first line
        ,"form":                            //The default is a style
            [{
                "desc": "A simple style for the test questions, note that the encoding format must be UTF8, otherwise it cannot display Chinese"
                                            //Will the number of characters starting with the number increase beyond the limit?
                , "ans":                    //ABCD add the corresponding candidate answer
                    [{
                        "desc": "The correct answer for design"
                        , "isValid":true    //ABCD followed by answer line
                    },{
                        "desc": "Candidate answer 1"
                    },{
                        "desc": "Candidate answer 2"
                    },{
                        "desc": "Candidate answer 3"
                    }]
            }]
    }
 *
 * Procedure steps:
 *  1.  Reads each line of a text file, records necessary information, and forms an output array object;
 *  2.  Output statistics and output array object to file
 * Created by Administrator on 2016/4/1.
 */
var async        = require('async');
/**The directory where SmartExam exported files need to be imported
 * TODO Imported file requirements：
 * 1. Must end with .txt
 * 2. UTF8 encoding
 * 3. The format of the export file name is: <original file name>.json
 *      For example: abc.txt is exported as abc.txt.json
 *    So you cannot have a file with the same name as the export file, otherwise it will be added to this file
 * @type {string}
 */

var importDir = 'D:/yuyi/SmartExam/20160402转易盘/TOC/';
//File Template Regular Expressions to Import
var fileReg = '/C\d+\.txt/';
//Conversion machine
var qLib = require('./questionParse.js');
//All files in the directory are read
var DirList = require('./dirList.js');

//Read files and process files asynchronously
DirList.readDir(importDir, function(err, list){
    if(err){
        console.log('Error reading the file list in the import directory:', err);
        return;
    }

    if(!list || list.length<1) {
        console.log('Error reading file list in import directory: No files were read');
        return;
    }

    var index = 0;
    var len = list.length;
    async.whilst(
        function(){
            return index<len;
        },function(cb){
            var fileName = list[index].name;
            index ++;
            //Currently only processing txt files
            var pos = fileName.lastIndexOf('.');
            var extension = fileName.substr(pos+1);
            if('|txt|'.indexOf(extension) <0) {
                cb();
                return;
            }

            //Splicing into a complete file path
            fileName = importDir + fileName;

            //Complete conversion
            qLib.init();
            var lineReader = require('./line_reader');
            lineReader.eachLine(fileName, function (line, last) {
                qLib.consume(line);

                if (last) {
                    //Output into json file
                    console.log('Successfully read in ', fileName);
                    fileName += '.json';
                    qLib.output(fileName);
                    console.log('\tsuccessfully written ', fileName);
                    cb();
                }
            });
        },function(){
            console.log('Done');
        }
    );
});


