/** File (directory) objects */
var mongoose = require('mongoose');
var Schema   = mongoose.Schema;
var Pinyin   = require('../libs/pinyin');

/**
 * Define the user's table structure files {
 *      name        Display names to users without extensions
 *      ,fname      Real file name
 *      ,extension  extension name
 *      ,size       File size, unit b
 *      ,mimetype   Types of
 *
 *      ,encoding   coding
 *      ,path       Absolute path, with / split each layer, without the file name itself
 *      ,isFile     true Is a file, false is a directory
 *      ,lastModified   Last modified time, only record the time of upload, replace, create
 *      ,history:[{name,date,type,remark}] Modify history, user is user ID, date is modification time, type operation type, remark comment
 * }
 * @type {Schema}
 */
var HistorySchema = new Schema(
    {
        name: {type: mongoose.Schema.Types.ObjectId, ref: 'User'}
        ,date: {type: Date, default:Date.now()}
        ,type: {type: String, required: true}
        ,ip: {type: String}
        ,remark: {type: String}
    }
);
var FileSchema = new Schema({
    name: {type: String, required: true}
    ,fullname: {type: String}
    ,_p_name: {type: String, select: false}
    ,fname: {type: String}
    ,extension: {type: String}
    ,mimetype: {type: String}
    ,size: {type:Number, default:0}

    ,path: {type: String, required: true, index: true}
    ,_p_path: {type: String, select: false}
    ,encoding: {type: String}
    ,isFile:{type: Boolean, default:true}
    ,history:[HistorySchema]
    ,lastModified: {type: Date}
    ,isDelete:{type: Date, default:null}
});

FileSchema.pre('save', function (next) {
    var file = this;
    //Make sure the extension is lowercase
    if(file.isFile) {
        if (file.isModified('extension'))
            file.extension = file.extension.toLowerCase();
        //The full name of the record file
        file.fullname = file.name + '.' + file.extension;
    }else
        file.fullname = file.name;

    if (file.isModified('name')) file._p_name = Pinyin.parse(file.name);
    if (file.isModified('path')) file._p_path = Pinyin.parse(file.path);

    //Record the last modified time
    if (file.isModified('history')){
        //The most recent operation is always the first element of the array
        if('upload|replace|create|rename|cut|copy|move|paste'.indexOf(file.history[0].type)>-1){
            file.lastModified = file.history[0].date = Date.now();
        }
    }

    next();
});
module.exports = mongoose.model('File', FileSchema);