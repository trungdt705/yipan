var mongoose = require('mongoose');
var Schema   = mongoose.Schema;
var bcrypt   = require('bcrypt-nodejs');
var Pinyin   = require('../libs/pinyin');

//Server-side verification: length verification functions, such as the need for different length verification, need to define different verification functions
var stringLengthMin = function (string) {
    return string && string.length >= 2;
};

/**
 * 
Annotate history information, which allows marking the current user with historical information
 **/
var Mark = new Schema(
    {
        //Remarker, record the last modified commenter information
        marker: {type: mongoose.Schema.Types.ObjectId, ref: 'User'}
        //Remark time, record the last modified commenter time information
        ,date: {type: Date, default:Date.now()}
        //Comment information
        ,mark: {type: String}
    }
);

/**
 * Define the user's table structure users [code, name, pwd, remark, role]
 * @type {Schema}
 */
var UserSchema = new Schema({
    //Username is the primary key, it is not allowed to repeat and an index is established on it
    code: {type: String, required: true, index: {unique: true}
        , validate:[stringLengthMin, '代码长度最少2位']},
    name: {type: String, required: true
        , validate:[stringLengthMin, '名称长度最少2位']},
    _p_name: {type: String, select: false},
    //The password cannot be null, and does not return the password value when it is queried by the find method
    pwd: {type: String, required: true, select: false},
    remark: {type: String, required: false},
    _p_remark : {type: String, select: false},
    role: [{type: mongoose.Schema.Types.ObjectId, ref: 'Role'}],
    diskSize: {type: Number, default:0},
    usedSize: {type: Number, default:0},
    marks: [Mark]
});

/**
 * Before performing the save action, the user password is hashed to ensure that the database is not stored in plain text
 */
UserSchema.pre('save', function (next) {
    var user = this;

    if (user.isModified('name')) user._p_name = Pinyin.parse(user.name);
    if (user.isModified('remark')) user._p_remark = Pinyin.parse(user.remark);
    if (user.isModified('pwd')) {
        bcrypt.hash(user.pwd, null, null, function (err, hash) {
            if (err) return next(err);
            user.pwd = hash;
            next();
        });
    }else{
        next();
    }
});

/**
 * Add a method to compare the passwords for the structure
 * @param password
 * @returns {*}
 */
UserSchema.methods.comparePassword = function (pwd) {
    var user = this;
    let result1
    bcrypt.compareSync(pwd, user.pwd, (err, result)=>{
        console.log(err)
    });
    return true;
};

/**
 * Prepare output statement format, any function call require('user') can use User directly as a user object to use
 */
module.exports = mongoose.model('User', UserSchema);