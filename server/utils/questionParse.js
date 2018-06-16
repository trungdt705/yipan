/**
An analysis library designed for the import of questions, responsible for accepting the questions read from the text file, and saving the format of the questions according to the context
 * Created by yy on 2015/6/22.
 */
var fs           = require('fs');

module.exports = (function (){
    var qLib = {};
    //Current status
    qLib.current = null;
    //Object structure that holds converted information
    qLib.data = null;

    //    Automatic machine initialization
    qLib.init = function(){
        qLib.current = qLib.stateBegin;
        qLib.data = {type:'',found:[], desc:'', ans:[]};
    };

    //In the initial state, after the comment line is encountered, it goes to the comment state and records the chapter information in the comment.
    //Because the chapter information reflected in the annotation is not standard, ignore this information and start directly from the stem
    qLib.stateBegin = function(transite){
        //If it is a number plus a point, it is the beginning of a new topic
        //The matching pattern is the starting point in the form of numbers and dots
        var matched = transite.match( /^\d+\./);
        if(matched && matched.length>0){
            //Start a new question and save a new question
            qLib.data.desc = transite.substr(matched[0].length);

            //Go to read dry state
            qLib.current = qLib.stateDesc;
        }
        //All other inputs are ignored
    };

    //Read the new dry state, and the sign of the next state is encountered in the form of the answer ABCD plus
    //Otherwise, it can be thought of as a form of writing a title and adding it to existing ones.
    qLib.stateDesc = function(transite){
        //If it is a number plus a point, it is the beginning of a new topic
        //The matching pattern is the starting point in the form of numbers and dots
        var matched = transite.match( /^\w\./);
        if(matched){
            //Start a new candidate answer and save it
            qLib.newAnswer(transite);

            //Go to read answer status
            qLib.current = qLib.stateAnswer;
        }else {
            //All other inputs are extensions of the questions
            qLib.data.desc += transite;
        }
    };

    //The candidate answer status is read, and the flag that goes to the next state is encountered with the question number:”
    //Otherwise, see if it is the format of the candidate answer in order to add new candidate answers,
    // Otherwise it is regarded as an extension of the previous candidate answer.
    qLib.stateAnswer = function(transite){
        if(transite.indexOf('Question number:')==0){//Question number
            //Go to read reference answer status
            qLib.current = qLib.stateValidAnswer;
        }else {
            //If it is a number plus a point, it is the beginning of a new topic
            //The matching pattern is the starting point in the form of numbers and dots
            var matched = transite.match(/^\w\./);
            if (matched) {
                //Start a new candidate answer and save it
                qLib.newAnswer(transite);
            } else {
                //All other input is an extension of the previous candidate answer
                qLib.extendAnswer(transite);
            }
        }
    };

    // Referring to the answer, the sign of the next state is encountered "answer:”
    qLib.stateValidAnswer = function(transite){
        if(transite.indexOf('answer:')==0){
            //Set reference correct answer
            qLib.setValidAnswer(transite.substr('answer:'.length));

            //Go to read question type status
            qLib.current = qLib.stateType;
        }
    };

    // Test question type, the sign that goes to the next state is encountered the question type:”
    qLib.stateType = function(transite){
        if(transite.indexOf('Question type:')==0){
            //Set questions
            var type = transite.substr('Question type:'.length);
            if(qLib.data.type.indexOf(type)<0)
                qLib.data.type += ',' + type;

            //Complete reading of a problem
            qLib.finishOne();

            //Go to the start state and wait for the next new question to appear
            qLib.current = qLib.stateBegin;
        }
    };

    //Add a candidate answer
    qLib.newAnswer = function(desc){
        qLib.data.ans.push({desc:desc});
    };

    //Set reference answer
    qLib.setValidAnswer = function(answerCode){
        //Comparing all candidate answers that are found now, if they have a prefix, mark them as reference answers
        for(var i in qLib.data.ans) {
            if(qLib.data.ans[i].desc.indexOf(answerCode)==0)
                qLib.data.ans[i].isValid = true;
        }
    };

    //Extend a candidate answer
    qLib.extendAnswer = function(desc){
        var len = qLib.data.ans.length;
        //Find the last candidate answer and extend it
        if(len>0){
            qLib.data.ans[len-1].desc += desc;
        }
    };

    //Finish parsing a problem and save the problem to the discovered array
    qLib.finishOne = function(){
        //Whether you need to save the original question, check by checking whether you have saved the questions
        if(qLib.data.desc){
            //Format the candidate answer array because the answer array is prefixed with the ABCD dot and must be removed uniformly
            var ans = [];
            for(var i in qLib.data.ans) {
                if(qLib.data.ans[i].isValid)
                    ans.push({desc:qLib.data.ans[i].desc.substr(2),isValid:true});
                else
                    ans.push({desc:qLib.data.ans[i].desc.substr(2)});
            }

            //Add to the discovered array
            qLib.data.found.push({
                desc:qLib.data.desc
                ,ans:ans
            });
        }

        //Initialize the next question
        qLib.data.desc = '';
        qLib.data.ans = [];
    };

    /** Accepts one row of data read in the text */
    qLib.consume = function(line){
        if(line && line.trim().length>0) {
            //The current state accepts a transition
            qLib.current(line.trim());
        }
    };

    //Convert all the problems found to the JSON format required by YiPan
    qLib.generateJSON = function(){
        qLib.data.json = null;
        /**
         * "type": "Single election"                     //The last line of question type gets from
         ,"category": "Chapter III Static Test"      //The last/after string in the first line //Chapter III Static Test
         ,"form":                            //The default is a style
            [{
                "desc", "ans"[{"desc","isValid"}]
            }]
         */
        var json = [];
        var type = qLib.data.type;
        if(type.length<1) return;
        //Remove the beginning,
        type = type.substr(1);
        if(type.indexOf(',')>-1){
            //Again found that there are multiple types, which is currently not allowed
            return;
        }else //The legal type mark takes only the first 2 digits
            type = type.substr(0,2);

        for(var i in qLib.data.found){
            json.push({type:type,form:[{
                desc:qLib.data.found[i].desc
                ,ans:qLib.data.found[i].ans
            }]});
        }

        qLib.data.json = json;
    };

    //Output to a text file
    qLib.output = function(fileName){
        //The import format needed to make YiPan
        qLib.generateJSON();

        //console.log(JSON.stringify(qLib.data.json));
        if(qLib.data.json){
            // If writeFile is used, old files are deleted and new files are written directly
            fs.appendFile(fileName, JSON.stringify(qLib.data.json), function(err){
                if(err)
                    console.log("Write file[" , fileName , "]failure " , err);
                else
                    console.log("Write file[" , fileName , "]success ");
            });
        }else{
            console.log('Failed to convert file:', JSON.stringify(qLib.data));
        }

    };

    return qLib;
})();
