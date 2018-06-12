/**
 *  Initialize the database to increase the permissions and user operations for the first time to initialize the database
 * Created by Administrator on 2015/9/15.
 */
var config = require('../../config');
var mongoose = require('mongoose');
mongoose.connect(config.database, {useMongoClient:true});
var User = require('../models/user');
var Role = require('../models/role');

var role = new Role();
role.code = 'supervisor';
role.name = 'All permissions';
role.remark = 'The greatest authority, can do anything';
role.permits = '????';
role.save(function(err){
    if(err){
        console.log('saving role failed: ', err);
        return;
    }
    console.log('saving role success.');

    var user = new User();
    user.name = 'administrator';
    user.code = 'admin';
    user.pwd = '$2a$10$/35Kes9hrZ33sxvXojAqzOlar1gBHr/bcat7AuMyKzaKeApv4TJ5a';
    user.role = role._id;
    user.remark = 'System administrator';
    user.save(function (err) {
        if(err){
            console.log('saving user failed: ', err);
            return;
        }
        console.log('saving user success.');
        return;
    });
});

