/**
 * Replace the Chinese characters in a program file and write it back to the source file so that the program file can be executed directly
 * Created by Administrator on 2016/4/20.
 */

var fileName = '11.js';
var fs           = require('fs');
var lineReader = require('./line_reader.js');

var corrected = [];

var chnChars = [
    {chn:'；', en:';'}
    ,{chn:'：', en:':'}
    ,{chn:'“', en:'"'}
    ,{chn:'”', en:'"'}
    ,{chn:'（', en:'('}
    ,{chn:'）', en:')'}
    ,{chn:'，', en:','}
];

//Replace Chinese characters in a line of text
var replaceLine = function(line){
    if(!line) return '';
    line = line.replace(/；/g, ';');
    line = line.replace(/：/g, ':');
    line = line.replace(/，/g, ',');
    line = line.replace(/“/g, '"');
    line = line.replace(/”/g, '"');
    line = line.replace(/（/g, '(');
    line = line.replace(/）/g, ')');
    return line;
}

//Reading each line of a program file
lineReader.eachLine(fileName, function (line, last) {
    //Put the replaced text into an array
    corrected.push(replaceLine(line));

    //After the end, the output to the original file
    if (last) {
        //Output into json file
        console.log('Successfully read in ', fileName);

        var newName = fileName + '.en.js';
        // If writeFile is used, old files are deleted and new files are written directly
        fs.appendFile(newName, corrected.join('\n'), function(err){
            if(err)
                console.log("Write file[" , newName , "]failure " , err);
            else
                console.log("Write file[" , newName , "]success ");
        });

        console.log('\successfully written ', fileName);
    }
});
