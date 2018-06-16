/**
 * A question analysis library designed for importing JSON questions and accepting questions in JSON format.
 * And save the format of the questions, can be output to the json file
 * 
Imported format analysis:
 * 1.   The import is generally an object format, where the type attribute indicates that the file contains all question types
 * 2.   Its attribute is an array of all the test questions. There are mainly two types of objects that make up group and question, which are identified by the cls attribute.
 * 3.   The question object contains two useful attributes of desc and ans, where ans is an array containing two attributes: desc and vld, which can directly correspond to a question
 * 4.   Group contains multiple question objects to form a question with multiple styles
 * 5.   Manually add the category attribute to indicate the generic of the question
 * Created by yy on 2015/6/22.
 */
var fs           = require('fs');

module.exports = (function (){
    var qLib = {};

    //Convert all the problems found to the JSON format required by YiPan
    qLib.convert = function(readed){
        qLib.json = null;
        /**
         * "type": "Single selection"                     //From
         ,"category": "Chapter III Static Test"      //The last/after string in the first line
         ,"form":                            //The default is a style
            [{
                "desc", "ans"[{"desc","isValid"}]
            }]
         */
        var json = [];

        var type = readed.type;
        var its = readed.its;

        var form;
        for(var i in its){
            form = qLib.readQuestion(its[i]);
            if(form && form.length>0)
                json.push({type:type, category:its[i].category, desc:form[0].desc, form:form});
        }

        qLib.json = json;
        console.log('Find ', json.length, ' Questions!');
    };

    /** Convert an array of answers to a question */
    qLib.readAnswer = function(item){
        var ans = [];

        for(var i in item){
            if(item[i].vld)
                ans.push({desc:item[i].des, isValid:true});
            else
                ans.push({desc:item[i].des});
        }

        return ans;
    };

    /** Transform an issue, mainly an array of descriptions and answers, ie the form attribute */
    qLib.readQuestion = function(item){
        var q = [];
        if(item.cls == 'Question'){
            q.push({desc: item.des, ans: qLib.readAnswer(item.ans)});
        }else if(item.cls == 'Group'){
            //There are multiple styles
            for(var i in item.qts){
                q.push({desc: item.qts[i].des, ans: qLib.readAnswer(item.qts[i].ans)});
            }
        }else{
            console.log('unknown cls property: ', JSON.stringify(item));
            return null;
        }
        return q;
    };

    //Output to a text file
    qLib.output = function(fileName){
        //console.log(JSON.stringify(qLib.data.json));
        if(qLib.json){
            // If writeFile is used, old files are deleted and new files are written directly
            fs.appendFile(fileName, JSON.stringify(qLib.json), function(err){
                if(err)
                    console.log("Write file[" , fileName , "]failure " , err);
                else
                    console.log("Write file[" , fileName , "]success ");
            });
        }else{
            console.log('Failed to convert file:', JSON.stringify(qLib.json));
        }
    };

    return qLib;
})();
