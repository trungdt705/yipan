var mongoose = require('mongoose');
var User = require('./models/user');
var SignGroup = require('./models/signgroup');
var QCategory = require('./models/qcategory');
var Question = require('./models/question');
var Exam = require('./models/exam');
var System = require('./models/system');
var ExamConfig = require('./models/examconfig');
var Sheet = require('./models/sheet');
var Check = require('./models/check');
var Sign = require('./models/sign');
var Role = require('./models/role');
var Log = require('./models/log');
var File = require('./models/file');
var ServerLogger = require('./libs/serverLogger');
var jwt = require('jsonwebtoken');
var config = require('../config');
var Const = require('./libs/Const');
var pCode = require('./libs/pCode');
var multer = require('multer');
var superSecret = config.secret;
var fs = require('fs');
var utils = require('./libs/utils');
var async = require('async');

/**
 * Create a route object back through the current application and the Express object
 */
module.exports = function (app, express) {
    //The route object to be returned is initialized to the basic route object of Express
    var apiRouter = express.Router();

    //////////authenticate//////////////////////////////
    apiRouter.post('/authenticate', function (req, res) {
        ////Test read client IP
        // console.log('IP = ', utils.getClientIP(req));

        // console.log('req = ', req.body);
        if (!req.body.code) {
            res.json({ message: Const.Msg.NoCode });
        } else if (!req.body.pwd) {
            res.json({ message: Const.Msg.User.NoPWD });
        } else {
            //console.log('to locate user with code =', req.body.code);
            // Use mongoose to find the specified username, the returned object is saved to user
            User.findOne({
                code: req.body.code
            }).select('_id code name pwd role').populate('role').exec(function (err, user) {
                if (err) throw err;
                //console.log('get user = ', JSON.stringify(user));
                // no user with that username was found
                if (!user) {
                    res.json({ message: Const.Msg.CodeNotExist });
                } else if (user) {
                    //console.log('found user : ', user);
                    //console.log('found user with _id : ', user._id);
                    // Password checking, here compare password method using User model
                    var isValidPassword;
                    try {
                        isValidPassword = user.comparePassword(req.body.pwd);
                    } catch (e) {
                        res.json({ message: 'Bcypt verification error:' + e.name + ' ' + e.message });
                        return;
                    }
                    if (!isValidPassword) {
                        res.json({ message: Const.Msg.User.PwdWrong });
                    } else {
                        var permits = null;
                        //var path = null;
                        if (user.role) {
                            for (var i in user.role) {
                                permits = pCode.mergePermit(permits, user.role[i].permits);
                                //path = pCode.mergePath(path, user.role[i].paths);
                            }
                        }

                        //user.permits = '0000';
                        user.permits = permits;
                        //console.log('user = ', JSON.stringify(user));
                        //console.log('permits = ', permits);

                        // Use [current user information + public key + connection parameters] to generate connection tags
                        var userInfo = {
                            _id: user._id,
                            code: user.code,
                            name: user.name,
                            permits: user.permits
                        };
                        //console.log('userInfo =', userInfo);
                        var token = jwt.sign(userInfo, superSecret, {
                            expiresInMinutes: 180
                        });

                        // Returns success information and appends newly generated connection tags for later connection
                        var userData = {};
                        userData.permits = user.permits;
                        userData._id = user._id;
                        userData.code = user.code;
                        userData.name = user.name;
                        res.json({
                            success: true,
                            message: Const.Msg.User.LoginOK,
                            user: userData,
                            token: token
                        });
                    }
                }
            });
        }
    });

    // Test the path to ensure that web pages can be displayed without landing
    apiRouter.get('/', function (req, res) {
        res.json({ message: Const.Msg.Welcome });
    });

    //// The middle layer to add actions for all other requests, here is mainly to determine whether you have already logged in, that is, whether there is a token tag
    apiRouter.use(function (req, res, next) {
        // Get tag, you can set the token by URL (Get method), param (post method) or header method
        var token = req.body.token || req.params.token || req.headers['x-access-token'];
        if (token) {
            //console.log('token =',token);
            // Marked for verification
            jwt.verify(token, superSecret, function (err, decoded) {
                if (err) {
                    console.log(err);
                    res.status(403).send({
                        success: false,
                        message: Const.Msg.Token.Invalid
                    });
                } else {
                    // Decoded information is stored in the request, named decode
                    //console.log('decoded = ', decoded);
                    req.decoded = decoded;

                    //Permission authentication
                    //You can use the req.method and req.path to determine the request method and relative path
                    //console.log('Method: ', req.method);
                    //console.log('Path: ', req.path);
                    //console.log('Decoded: ', decoded);
                    // Continue to process requests
                    next();
                }
            });
        } else {
            console.log('no token');
            res.status(403).send({
                success: false,
                message: Const.Msg.Token.NONE
            });
        }
    });

    //Processing requests for uploaded files first
    apiRouter.use(multer({
        dest: config.uploadDir
        , onFileUploadComplete: function (file, req, res) {
            /** Get file information from file and request information, save to database
             * completing  { fieldname: 'file',
                  originalname: 'about_pic.jpg',
                  name: 'fileabout_pic_2015-7-9_21-17-45.jpg',
                  encoding: '7bit',
                  mimetype: 'image/jpeg',
                  path: 'd:\\Mean-workspace\\uploads\\fileabout_pic_2015-7-9_21-17-45.jpg',
                  extension: 'jpg',
                  size: 60053,
                  truncated: false,
                  buffer: null }
             body  { path: 'current path with / as separator',
                  size: '60053',
                  name: 'about_pic',
                  user: '5548db6769bd4a7e3595fc01' }
             */
            //First determine if the upload file exists
            var criteria = { path: req.body.path, name: req.body.name, extension: file.extension };
            File.find(criteria).exec(function (err, data) {
                if (err) return res.send(err);
                //Execution success depends on the existence of records
                if (data && data.length > 0) {
                    //See if you need to delete the overwritten file
                    var oldFile = data[0].fname;
                    if (config.uploadRemoveReplaced) {
                        //console.log('found file to be replaced: ', data[0]);
                        fs.unlink(config.uploadDir + oldFile, function () {
                            //console.log('remove file success: ', config.uploadDir + '/' + oldFile);
                        });
                    }

                    //Update period field information
                    var replaceTime = Date.now();
                    data[0].fname = file.name;
                    data[0].size = req.body.size;
                    data[0].encoding = file.encoding;
                    data[0].history.unshift({ name: req.body.user, date: replaceTime, type: 'replace', remark: 'replaced ' + oldFile });
                    data[0].save(function (err) {
                        if (err) res.send(err, file);
                        else res.json({ isSuccess: true, data: file });
                    });
                } else {
                    //Does not exist, add
                    var uploadTime = Date.now();
                    var f = new File();
                    f.name = req.body.name;
                    f.fname = file.name;
                    f.extension = file.extension;
                    f.mimetype = file.mimetype;
                    f.size = req.body.size;

                    f.path = req.body.path;
                    f.encoding = file.encoding;
                    f.history = [{ name: req.body.user, date: uploadTime, type: 'upload', ip: utils.getClientIP(req) }];
                    f.save(function (err, data) {
                        if (err) {
                            res.send(err);
                        }
                        else
                            res.json({ isSuccess: true, data: data });
                    });
                }
            });
        }
        , rename: function (fieldname, filename, req, res) {
            return utils.generateNewName(filename)
        }
    }));

    ////Reprocess download requests
    //apiRouter.route('/download')
    //    .post(function (req, res){
    //        var realname = config.uploadDir + req.body.fname;
    //        var filename = req.body.filename;
    //        console.log('call download with ', realname, ', ', filename);
    //        res.download(realname, filename);
    //        return;
    //    });

    apiRouter.route('/imageUploader')
        .post(function (req, res) {
            //do nothing, Vì multer đã xử lý yêu cầu và trả lại thông tin
            //console.log('res = ', res);
            //res.json({message: 'ok'});
        });

    //Get server time
    apiRouter.route('/systemdate')
        .get(function (req, res) {
            res.json({ success: true, date: new Date() });
        })
        ;

    //////////checks//////////
    apiRouter.route('/checks')
        //Used to query the number of records under the specified conditions
        .patch(function (req, res) {
            //if(!ServerLogger.allowed('user','view', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            var criteria = {};
            if (req.body.criteria) {
                criteria = req.body.criteria;
            }

            //console.log('roles patch with criteria = ', criteria);
            Check.count(criteria).exec(function (err, count) {
                if (err) return res.send(err);
                res.json({ success: true, count: count });
            });
        })

        //Used to query data collections by page
        .put(function (req, res) {
            //if(!ServerLogger.allowed('user','view', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            //Query data collection, here are pages to query, so need to consider four parameters
            // currentPage，pageSize，criteriaFilter，criteriaSort
            //Default parameter settings
            var criteriaFilter = {};
            if (req.body.criteriaFilter) {
                criteriaFilter = req.body.criteriaFilter;
            }

            var criteriaSort = { create: -1 };
            if (req.body.criteriaSort) {
                criteriaSort = req.body.criteriaSort;
            }

            if (req.body.currentPage && req.body.pageSize) {
                var skip = req.body.currentPage;
                var pageSize = req.body.pageSize;
                //Calculate the number of documents that need to be skipped
                skip = (skip - 1) * pageSize;
                Check.find(criteriaFilter).sort(criteriaSort).skip(skip).limit(pageSize).populate('owner signgroup').exec(function (err, data) {
                    if (err) return res.send(err);
                    res.json(data);
                });
            } else {
                //No paging information, return all data records directly
                Check.find(criteriaFilter).sort(criteriaSort).exec(function (err, data) {
                    if (err) return res.send(err);
                    res.json(data);
                });
            }
        })

        //Used to add records
        .post(function (req, res) {
            //if(!ServerLogger.allowed('user','create', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            var markPrefix = '';
            if (req.body.hasOwnProperty('markPrefix'))
                markPrefix = req.body.markPrefix;
            var marker = req.body.marker;

            //For each user, add a comment
            var insertMark = req.body.detail.map(function (detail) {
                if (detail.mark)
                    return User.update({ _id: detail._id }, { $push: { marks: { marker: marker, mark: markPrefix + detail.mark } } });
                else
                    return User.update({ _id: detail._id }, { $push: { marks: { marker: marker, mark: markPrefix } } });
            });

            var check_id;
            Promise
                .all(insertMark)
                .then(function () {
                    var user = new Check();
                    user.owner = req.body.owner;
                    user.signgroup = req.body.signgroup;
                    user.isAccumulated = req.body.isAccumulated;
                    user.numExpected = req.body.numExpected;
                    user.numReal = req.body.numReal;
                    //Rebuild spot check information table
                    if (req.body.detail) {
                        var detail = [];
                        for (var i in req.body.detail)
                            detail.push(req.body.detail[i]._id);
                    }
                    user.detail = detail;
                    if (req.body.hasOwnProperty('remark')) user.remark = req.body.remark;

                    return user.save();
                })
                .then(function (data) {
                    if (!data)
                        return Promise.reject(data);

                    //Get and save the id of the new object
                    check_id = data._id;

                    return Promise.resolve();
                })
                .then(function () {
                    res.json({ success: true, _id: check_id, message: Const.Msg.AddOK });
                })
                .catch(function (error) {
                    res.send({ message: 'New test object failed' + JSON.stringify(error) });
                })
                ;
        })
        ;

    //////////check single//////////////////////////////
    apiRouter.route('/checks/:check_id')
        // Get details of a specified spot check
        .get(function (req, res) {
            Check.findOne({ _id: req.params.check_id }).populate('detail', 'code name marks')
                .exec(function (err, data) {
                    if (err)
                        return res.send(err);
                    res.json({ data: data, success: true });
                });
        })

        /**
         * Used to find the list of eligible students when spot checking, random sampling process occurs on the client
         *      The steps are:
         *      1.  Query all student entities included in the check-in object st;
         *      2.  If it is not a cumulative check, return st for a check;
         *      3.  Otherwise, determine the latest check-in time of the current check-in object t;
         *      4.  Query initiation time >= t, and it involves all sampling records of the check-in object;
         *      5.  Remove the list of students included in each spot check record from st;
         *      6.  Return to the remaining student list.
         * Exception handling: If there is at least one remaining student list, it will return to the list successfully. Otherwise, if there is no remaining student list, an error message will be returned.
         */
        .post(function (req, res) {
            //The incoming url parameter contains the check-in object ID
            var signgroup = req.params.check_id;

            var candidate;
            Promise.resolve()
                .then(function () {
                    // 1.  Query the matching pattern of the check-in object first;
                    return SignGroup.findOne({ _id: signgroup }, { pattern: 1 });
                })
                .then(function (data) {
                    // 1.  Query all student entities included in the check-in object st;
                    if (!data || !data.pattern)
                        return Promise.reject('Failed to query the sign in object mode');

                    return User.find({ code: { $regex: data.pattern } }, { code: 1, name: 1 });
                })
                .then(function (data) {
                    if (!data || !data.length)
                        return Promise.reject('No matching student found');
                    candidate = data;

                    if (!req.body.isAccumulated) {
                        //If it is a new spot check, return all candidates directly
                        res.json({ success: true, candidate: candidate });
                        return Promise.resolve();
                    }

                    //    3.  Otherwise, determine the latest check-in time of the current check-in object t;
                    return Check.find({ signgroup: signgroup, isAccumulated: false }, { create: 1 }).sort({ create: -1 }).limit(1);
                })
                .then(function (data) {
                    if (data && data.length > 0) {
                        //Query initiation time >=t, and all sampling records related to the check-in object
                        return Check.find({ signgroup: signgroup, create: { $gte: data[0].create } }, { detail: 1 });
                    } else {
                        //Query all matching spot checks
                        return Check.find({ signgroup: signgroup }, { detail: 1 });
                    }
                })
                .then(function (data) {
                    if (data && data.length > 0) {
                        /** Remove the list of students included in each spot check record from st;
                         * step:  1. Combine the list of students included in all spot checks into an array ss
                         *         2.   Check all the candidate lists. If _id is included in ss, delete it from the candidate set.
                         */
                        var ss = [];
                        for (var i in data) {
                            for (var k = 0; k < data[i].detail.length; k++)
                                ss.push(data[i].detail[k].toString());
                        }
                        for (var j = candidate.length - 1; j > -1; j--) {
                            if (ss.indexOf(candidate[j]._id.toString()) > -1)
                                candidate.splice(j, 1);
                        }
                    }

                    res.json({ success: true, candidate: candidate });
                    return Promise.resolve();
                })
                .catch(function (error) {
                    res.send({ message: JSON.stringify(error) });
                })
                ;
        })

        /** Student information used to query the specified student number */
        .put(function (req, res) {
            //At this point the incoming url parameter contains the student ID
            var usercode = req.params.check_id;
            User.findOne({ code: usercode }).select('code name')
                .exec(function (err, data) {
                    if (err) return res.send(err);
                    res.json({ data: data, success: true });
                });
        })

        // Delete specified spot checks
        .delete(function (req, res) {
            //if(!ServerLogger.allowed('user','delete', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            Check.remove({
                _id: req.params.check_id
            }, function (err) {
                if (err)
                    return res.send(err);
                ServerLogger.log(req.decoded._id, req.path, req.method, { _id: req.params.check_id });
                res.json({ success: true, message: Const.Msg.DelOK });
            });
        })
        ;


    //////////users//////////
    apiRouter.route('/users')
        //Return all records, generally used for association
        .get(function (req, res) {
            //Ascending name by default
            User.find({}).sort({ _p_name: 1 }).exec(function (err, data) {
                if (err) return res.send(err);
                res.json(data);
            });
        })

        //Used to query the number of records under the specified conditions
        .patch(function (req, res) {
            //if(!ServerLogger.allowed('user','view', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});
            var criteria = {};
            if (req.body.criteria) {
                criteria = req.body.criteria;
            }

            //console.log('roles patch with criteria = ', criteria);
            User.count(criteria).exec(function (err, count) {
                if (err) return res.send(err);
                // console.log('get userCount : ', count);
                res.json({ success: true, count: count });
            });
        })

        //Used to query data collections by page
        .put(function (req, res) {
            //if(!ServerLogger.allowed('user','view', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            //Query data collection, here are pages to query, so need to consider four parameters
            // currentPage，pageSize，criteriaFilter，criteriaSort
            //Default parameter settings
            var criteriaFilter = {};
            if (req.body.criteriaFilter) {
                criteriaFilter = req.body.criteriaFilter;
            }

            var criteriaSort = { code: 1 };
            if (req.body.criteriaSort) {
                criteriaSort = req.body.criteriaSort;
            }

            if (req.body.currentPage && req.body.pageSize) {
                var skip = req.body.currentPage;
                var pageSize = req.body.pageSize;
                //Calculate the number of documents that need to be skipped
                skip = (skip - 1) * pageSize;
                User.find(criteriaFilter).sort(criteriaSort).skip(skip).limit(pageSize).populate('role').exec(function (err, data) {
                    if (err) return res.send(err);
                    res.json(data);
                });
            } else {
                //No paging information, return all data records directly
                User.find(criteriaFilter).sort(criteriaSort).exec(function (err, data) {
                    if (err) return res.send(err);
                    res.json(data);
                });
            }
        })

        //Used to add records
        .post(function (req, res) {
            //if(!ServerLogger.allowed('user','create', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            var user = new User();
            user.name = req.body.name;
            user.code = req.body.code;
            user.pwd = req.body.pwd;
            user.role = req.body.role;
            user.diskSize = req.body.diskSize;
            user.marks = req.body.marks;
            if (req.body.hasOwnProperty('remark')) user.remark = req.body.remark;

            //console.log('ready to create a new supplier:', supplier);
            //console.log('pinyin of ', supplier.name, ' = ', Pinyin.getFullChars(supplier.name));
            user.save(function (err) {
                if (err) {
                    if (err.code == 11000)
                        return res.json({ message: Const.Msg.Duplicate });
                    else
                        return res.send(err);
                }
                ServerLogger.log(req.decoded._id, req.path, req.method, req.body, req.path + user._id);

                //Create a new directory for each ordinary user, allowing the user to modify the operation in their own directory
                //The name of the directory is the user Code
                var fo = new File();
                fo.name = user.code;
                fo.path = '.';
                fo.isFile = false;
                fo.extension = 'folder';
                fo.history = [{ name: req.decoded._id, type: 'create' }];
                fo.save(function (err) {
                    if (err) return res.send(err);
                    res.json({ success: true, message: Const.Msg.AddOK });
                });
            });
        })
        ;

    apiRouter.route('/usersop')
        // To generate a test paper for the transfer student
        .patch(function (req, res) {
            //First check if the student number exists
            User.find({ code: req.body.code }).exec(function (err, data) {
                if (err) return res.send(err);
                if (!data || data.length < 1)
                    return res.send('No match found [' + req.body.code + '] User');

                //Then see if the test paper has already been generated
                var user = data[0];
                Exam.find({ tester: user._id, config: req.body.config }).exec(function (err, data) {
                    if (err) return res.send(err);
                    if (data && data.length > 0)
                        return res.send('The student [' + req.body.code + '] Already generated test paper');
                    res.json({ data: user, success: true });
                });
            });
        })
        ;

    //////////user_id//////////////////////////////
    apiRouter.route('/users/:user_id')
        // Get the specified user's information
        .get(function (req, res) {
            User.findById(req.params.user_id, function (err, user) {
                if (err)
                    return res.send(err);

                //Calculate the actual capacity of the user. The query condition is all files under the current user.
                //Of course Admin users do not have statistics
                user.usedSize = 0;
                if (user.code != 'admin') {
                    var path = './' + user.code;
                    var pathReg = (path + '/').replace(/([*+-.?^${}()|[\]\/\\])/g, '\\$1');
                    //  In the user directory, or the file prefixed by the user's directory requires statistics
                    var criteriaDir = { '$or': [{ path: path }, { path: { $regex: '^(' + pathReg + ')' } }], isFile: true };
                    File.find(criteriaDir).select('size')
                        .exec(function (err, data) {
                            if (err) return res.send(err);
                            var usedSize = 0;
                            if (data) {
                                for (var i = 0; i < data.length; i++)
                                    if (data[i].size)
                                        usedSize += data[i].size;
                            }
                            user.usedSize = usedSize;
                            res.json({ data: user, success: true });
                        });
                } else {
                    res.json({ data: user, success: true });
                }
            });
        })

        // Used to insert new comment information
        .post(function (req, res) {
            Promise.resolve()
                .then(function () {
                    return User.update({ _id: req.params.user_id }, {
                        $push:
                            { marks: { marker: req.body.marker, mark: req.body.mark } }
                    });
                })
                .then(function () {
                    if (!data || !data.ok)
                        return Promise.reject('更新失败');

                    res.json({ success: true });
                    return Promise.resolve();
                })
                .catch(function (error) {
                    res.send({ message: '新增用户批注信息失败' + JSON.stringify(error) });
                })
                ;
        })

        // Update specified id user information
        .put(function (req, res) {
            //Do not do rights processing for now
            //if(!ServerLogger.allowed('user','update', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            User.findById(req.params.user_id, function (err, user) {
                if (err) return res.send(err);
                if (req.body.name) user.name = req.body.name;
                if (req.body.code) user.code = req.body.code;
                if (req.body.pwd) user.pwd = req.body.pwd;
                if (req.body.hasOwnProperty('marks')) user.marks = req.body.marks;
                if (req.body.hasOwnProperty('remark')) user.remark = req.body.remark;
                if (req.body.role) user.role = req.body.role;
                if (req.body.diskSize) user.diskSize = req.body.diskSize;

                user.save(function (err) {
                    //console.log('error = ',err);
                    if (err)
                        return res.send(err);
                    ServerLogger.log(req.decoded._id, req.path, req.method, req.body);
                    res.json({ success: true, message: Const.Msg.UpdateOK });
                });

            });
        })

        // Delete the specified user
        .delete(function (req, res) {
            //if(!ServerLogger.allowed('user','delete', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            User.remove({
                _id: req.params.user_id
            }, function (err, user) {
                if (err)
                    return res.send(err);
                ServerLogger.log(req.decoded._id, req.path, req.method, { _id: req.params.user_id });
                res.json({ success: true, message: Const.Msg.DelOK });
            });
        })
        ;

    //////////Questions//////////
    apiRouter.route('/questions')
        //Return all records, generally used for association
        .get(function (req, res) {
            //Ascending name by default
            Question.find({}).sort({ name: 1 }).exec(function (err, data) {
                if (err) return res.send(err);
                res.json(data);
            });
        })

        //Used to query the number of records under the specified conditions
        .patch(function (req, res) {
            //if(!ServerLogger.allowed('user','view', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            var criteria = {};
            if (req.body.criteria) {
                criteria = req.body.criteria;
            }

            //console.log('roles patch with criteria = ', criteria);
            Question.count(criteria).exec(function (err, count) {
                if (err) return res.send(err);
                //console.log('get userCount : ', userCount);
                res.json({ success: true, count: count });
            });
        })

        //Used to query data collections by page
        .put(function (req, res) {
            //if(!ServerLogger.allowed('user','view', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            //Query data collection, here are pages to query, so need to consider four parameters
            // currentPage，pageSize，criteriaFilter，criteriaSort
            //Default parameter settings
            var criteriaFilter = {};
            if (req.body.criteriaFilter) {
                criteriaFilter = req.body.criteriaFilter;
            }

            var criteriaSort = {};
            if (req.body.criteriaSort) {
                criteriaSort = req.body.criteriaSort;
            }

            if (req.body.currentPage && req.body.pageSize) {
                var skip = req.body.currentPage;
                var pageSize = req.body.pageSize;
                //Calculate the number of documents that need to be skipped
                skip = (skip - 1) * pageSize;
                Question.find(criteriaFilter).sort(criteriaSort).skip(skip).limit(pageSize).exec(function (err, data) {
                    if (err) return res.send(err);
                    res.json(data);
                });
            } else {
                //No paging information, return all data records directly
                Question.find(criteriaFilter).sort(criteriaSort).exec(function (err, data) {
                    if (err) return res.send(err);
                    res.json(data);
                });
            }
        })

        //Used to add records
        .post(function (req, res) {
            //if(!ServerLogger.allowed('user','create', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            var codeType = 'question';
            var _id;
            //Save the new question is divided into three steps, first obtain the maximum number of questions, then save, and finally update the maximum number
            Promise.resolve()
                .then(function () {
                    //1. Maximum number of queries
                    return System.findOne({ codeType: codeType }, { maxNo: 1 });
                })
                .then(function (data) {
                    console.log(data)
                    if (!data || !data.maxNo)
                        return Promise.reject('Failed to query the maximum number of test questions');
                    //2.Use this number to set the data's code field
                    var user = new Question();
                    user.code = utils.generateCode(codeType, data.maxNo);
                    user.lastModified = new Date();
                    user.category = req.body.category;
                    user.type = req.body.type;
                    user.point = req.body.point;
                    user.form = req.body.form;
                    if (req.body.hasOwnProperty('remark')) user.remark = req.body.remark;
                    return user.save();
                })
                .then(function (data) {
                    if (!data) //The return of save is a new object
                        return Promise.reject('Failed to save new question');
                    _id = data._id;
                    //Update number
                    return System.update({ codeType: codeType }, { $inc: { 'maxNo': 1 } });

                })
                .then(function (data) {
                    if (!data || !data.ok) //Update $inc returns {n:1, nModified:1, ok:1}
                        return Promise.reject('Failed to update the maximum number');
                    ServerLogger.log(req.decoded._id, req.path, req.method, req.body, req.path + _id);
                    res.json({ success: true, message: Const.Msg.AddOK });
                    return Promise.resolve();
                })
                .catch(function (error) {
                    res.send(error);
                })
                ;
        })
        ;

    ////////////////////////////////////////
    apiRouter.route('/questions/:_id')
        // Get the specified user's information
        .get(function (req, res) {
            Question.findById(req.params._id, function (err, user) {
                if (err)
                    return res.send(err);
                res.json({ data: user, success: true });
            });
        })

        // Update specified id user information
        .put(function (req, res) {
            //Do not do rights processing for now
            //if(!ServerLogger.allowed('user','update', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            Question.findById(req.params._id, function (err, user) {
                if (err) return res.send(err);
                if (req.body.name) user.name = req.body.name;
                if (req.body.category) user.category = req.body.category;
                if (req.body.type) user.type = req.body.type;
                if (req.body.point) user.point = req.body.point;
                if (req.body.form) user.form = req.body.form;
                if (req.body.hasOwnProperty('remark')) user.remark = req.body.remark;
                user.lastModified = new Date();

                user.save(function (err) {
                    //console.log('error = ',err);
                    if (err)
                        return res.send(err);
                    ServerLogger.log(req.decoded._id, req.path, req.method, req.body);
                    res.json({ success: true, message: Const.Msg.UpdateOK });
                });

            });
        })

        /** Merge multiple test questions into the current test
         * The steps are:
         *  1.  Query all involved test question objects
         *  2.  Targeting test question objects that need to be retained
         *  3.  Loop through all the query question objects and merge the style array into the retention question object
         *  4.  Modify the retention time and number of styles of saved questions and save them to the database
         *  5.  Delete other question objects
         *  6.  Return Merged question number, _id, and number of styles to the client
         */
        .post(function (req, res) {
            var info;
            var qAll = req.body;
            var forms = [];

            Promise.resolve()
                .then(function () {
                    //Execute the query with the passed parameters
                    return Question.find(qAll);
                })
                .then(function (data) {
                    console.log('data '+ data)
                    //Scan all questions, locate the questions that need to be saved, and collect other questions
                    for (var i = 0, len = data.length; i < len; i++) {
                        if (data[i]._doc._id == req.params._id) {
                            info = { _id: data[i]._doc._id, code: data[i]._doc.code };
                        }
                        forms = forms.concat(data[i]._doc.form);
                    }
                    info.numForm = forms.length;

                    //Modify the retention time and number of styles of saved questions and save them to the database
                    return Question.update({ _id: req.params._id }, {
                        $set: {
                            lastModified: new Date()
                            , numForm: forms.length
                            , form: forms
                        }
                    });
                })
                .then(function (data) {
                    if (!data || data.ok != 1) //Return of update {n:1, nModified:1, ok:1}
                        return Promise.reject('Failed to save merge question');

                    //Need to remove the ID of the test question from the condition, ie the first ID
                    qAll._id['$in'].splice(0, 1);
                    //Delete other questions
                    return Question.remove(qAll);
                })
                .then(function (data) {
                    if (!data || data.result.ok != 1) //The return of delete is CommandResult {result:{n:1, ok:1}}
                        return Promise.reject('Failed to delete merged test questions');
                    info.success = true;
                    return res.json(info);
                })
                .catch(function (error) {
                    res.send(error);
                })
                ;
        })

        // Delete the specified user
        .delete(function (req, res) {
            //if(!ServerLogger.allowed('user','delete', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            Question.remove({
                _id: req.params._id
            }, function (err, user) {
                if (err)
                    return res.send(err);
                ServerLogger.log(req.decoded._id, req.path, req.method, { _id: req.params._id });
                res.json({ success: true, message: Const.Msg.DelOK });
            });
        });

    //////////Test paper//////////
    apiRouter.route('/sheets')
        //Return all records, generally used for association
        .get(function (req, res) {
            //Ascending name by default
            Sheet.find({}).sort({ name: 1 }).exec(function (err, data) {
                if (err) return res.send(err);
                res.json(data);
            });
        })

        //Used to query the number of records under the specified conditions
        .patch(function (req, res) {
            //if(!ServerLogger.allowed('user','view', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            var criteria = {};
            if (req.body.criteria) {
                criteria = req.body.criteria;
            }

            //console.log('roles patch with criteria = ', criteria);
            Sheet.count(criteria).exec(function (err, count) {
                if (err) return res.send(err);
                //console.log('get userCount : ', userCount);
                res.json({ success: true, count: count });
            });
        })

        //Used to query data collections by page
        .put(function (req, res) {
            //if(!ServerLogger.allowed('user','view', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            //Query data collection, here are pages to query, so need to consider four parameters
            // currentPage，pageSize，criteriaFilter，criteriaSort
            //Default parameter settings
            var criteriaFilter = {};
            if (req.body.criteriaFilter) {
                criteriaFilter = req.body.criteriaFilter;
            }

            var criteriaSort = { name: 1 };
            if (req.body.criteriaSort) {
                criteriaSort = req.body.criteriaSort;
            }

            if (req.body.currentPage && req.body.pageSize) {
                var skip = req.body.currentPage;
                var pageSize = req.body.pageSize;
                //Calculate the number of documents that need to be skipped
                skip = (skip - 1) * pageSize;
                Sheet.find(criteriaFilter).sort(criteriaSort).skip(skip)
                    .populate('detail.category').limit(pageSize).exec(function (err, data) {
                        if (err) return res.send(err);
                        res.json(data);
                    });
            } else {
                //No paging information, return all data records directly
                Sheet.find(criteriaFilter).sort(criteriaSort).exec(function (err, data) {
                    if (err) return res.send(err);
                    res.json(data);
                });
            }
        })

        //Used to add records
        .post(function (req, res) {
            //if(!ServerLogger.allowed('user','create', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            var codeType = 'sheet';
            var _id;
            //Save the new question is divided into three steps, first obtain the maximum number of questions, then save, and finally update the maximum number
            Promise.resolve()
                .then(function () {
                    //1. Maximum number of queries
                    return System.findOne({ codeType: codeType }, { maxNo: 1 });
                })
                .then(function (data) {
                    if (!data || !data.maxNo)
                        return Promise.reject('Failed to query the maximum number of test questions');
                    //2.Use this number to set the data's code field
                    var user = new Sheet();
                    user.code = utils.generateCode(codeType, data.maxNo);
                    user.name = req.body.name;
                    user.detail = req.body.detail;
                    user.lastModified = new Date();
                    if (req.body.hasOwnProperty('remark')) user.remark = req.body.remark;
                    console.log(user)
                    return user.save();
                })
                .then(function (data) {
                    if (!data) //    The return of save is a new object
                        return Promise.reject('Failed to save new question');
                    _id = data._id;
                    //Update number
                    return System.update({ codeType: codeType }, { $inc: { 'maxNo': 1 } });

                })
                .then(function (data) {
                    if (!data || !data.ok) //Update $inc returns {n:1, nModified:1, ok:1}
                        return Promise.reject('Failed to update the maximum number');
                    ServerLogger.log(req.decoded._id, req.path, req.method, req.body, req.path + _id);
                    res.json({ success: true, message: Const.Msg.AddOK });
                    return Promise.resolve();
                })
                .catch(function (error) {
                    res.send(error);
                })
                ;
        });

    ////////////////////////////////////////
    //The aggregate request of the test paper, query the number of test questions included in various genera and types
    ////////////////////////////////////////
    apiRouter.route('/sheetop')
        .get(function (req, res) {
            Question.aggregate(
                [{ $group: { _id: { category: "$category", type: "$type" }, count: { $sum: 1 } } }]
            ).exec(function (err, ret) {
                if (err)
                    return res.send(err);
                res.json({ data: ret, success: true });
            });
        })
        ;

    ////////////////////////////////////////
    apiRouter.route('/sheets/:_id')
        // Get the specified user's information
        .get(function (req, res) {
            Sheet.find({ _id: req.params._id }).populate('detail.category').exec(function (err, data) {
                if (err)
                    return res.send(err);
                res.json({ data: data, success: true });
            });
        })

        // Update specified id user information
        .put(function (req, res) {
            //Do not do rights processing for now
            //if(!ServerLogger.allowed('user','update', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            Sheet.findById(req.params._id, function (err, user) {
                if (err) return res.send(err);
                if (req.body.name) user.name = req.body.name;
                if (req.body.detail) user.detail = req.body.detail;
                user.lastModified = new Date();
                if (req.body.hasOwnProperty('remark')) user.remark = req.body.remark;

                user.save(function (err) {
                    //console.log('error = ',err);
                    if (err)
                        return res.send(err);
                    ServerLogger.log(req.decoded._id, req.path, req.method, req.body);
                    res.json({ success: true, message: Const.Msg.UpdateOK });
                });

            });
        })

        // Delete the specified users
        .delete(function (req, res) {
            //if(!ServerLogger.allowed('user','delete', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            Sheet.remove({
                _id: req.params._id
            }, function (err, user) {
                if (err)
                    return res.send(err);
                ServerLogger.log(req.decoded._id, req.path, req.method, { _id: req.params._id });
                res.json({ success: true, message: Const.Msg.DelOK });
            });
        });

    //////////Question Category//////////
    apiRouter.route('/qcategorys')
        //Return all records, generally used for association
        .get(function (req, res) {
            //Ascending name by default
            QCategory.find({}).sort({ name: 1 }).exec(function (err, data) {
                if (err) return res.send(err);
                res.json(data);
            });
        })

        //Used to query the number of records under the specified conditions
        .patch(function (req, res) {
            //if(!ServerLogger.allowed('user','view', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            var criteria = {};
            if (req.body.criteria) {
                criteria = req.body.criteria;
            }

            //console.log('roles patch with criteria = ', criteria);
            QCategory.count(criteria).exec(function (err, count) {
                if (err) return res.send(err);
                //console.log('get userCount : ', userCount);
                res.json({ success: true, count: count });
            });
        })

        //Used to query data collections by page
        .put(function (req, res) {
            //if(!ServerLogger.allowed('user','view', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            //Query data collection, here are pages to query, so need to consider four parameters
            // currentPage，pageSize，criteriaFilter，criteriaSort
            //Default parameter settings
            var criteriaFilter = {};
            if (req.body.criteriaFilter) {
                criteriaFilter = req.body.criteriaFilter;
            }

            var criteriaSort = { name: 1 };
            if (req.body.criteriaSort) {
                criteriaSort = req.body.criteriaSort;
            }

            if (req.body.currentPage && req.body.pageSize) {
                var skip = req.body.currentPage;
                var pageSize = req.body.pageSize;
                //Calculate the number of documents that need to be skipped
                skip = (skip - 1) * pageSize;
                QCategory.find(criteriaFilter).sort(criteriaSort).skip(skip).limit(pageSize).exec(function (err, data) {
                    if (err) return res.send(err);
                    res.json(data);
                });
            } else {
                //No paging information, return all data records directly
                QCategory.find(criteriaFilter).sort(criteriaSort).exec(function (err, data) {
                    if (err) return res.send(err);
                    res.json(data);
                });
            }
        })

        //Used to add records
        .post(function (req, res) {
            //if(!ServerLogger.allowed('user','create', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            var user = new QCategory();
            user.name = req.body.name;
            if (req.body.hasOwnProperty('remark')) user.remark = req.body.remark;

            //console.log('ready to create a new supplier:', supplier);
            //console.log('pinyin of ', supplier.name, ' = ', Pinyin.getFullChars(supplier.name));
            user.save(function (err) {
                if (err) {
                    return res.send(err);
                }
                ServerLogger.log(req.decoded._id, req.path, req.method, req.body, req.path + user._id);
                res.json({ success: true, message: Const.Msg.AddOK });
            });
        });

    ////////////////////////////////////////
    apiRouter.route('/qcategorys/:_id')
        // Get the specified user's information
        .get(function (req, res) {
            QCategory.findById(req.params._id, function (err, user) {
                if (err)
                    return res.send(err);
                res.json({ data: user, success: true });
            });
        })

        // Update specified id user information
        .put(function (req, res) {
            //Do not do rights processing for now
            //if(!ServerLogger.allowed('user','update', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            QCategory.findById(req.params._id, function (err, user) {
                if (err) return res.send(err);
                if (req.body.name) user.name = req.body.name;
                if (req.body.hasOwnProperty('remark')) user.remark = req.body.remark;

                user.save(function (err) {
                    //console.log('error = ',err);
                    if (err)
                        return res.send(err);
                    ServerLogger.log(req.decoded._id, req.path, req.method, req.body);
                    res.json({ success: true, message: Const.Msg.UpdateOK });
                });

            });
        })

        // Delete the specified user
        .delete(function (req, res) {
            //if(!ServerLogger.allowed('user','delete', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            QCategory.remove({
                _id: req.params._id
            }, function (err, user) {
                if (err)
                    return res.send(err);
                ServerLogger.log(req.decoded._id, req.path, req.method, { _id: req.params._id });
                res.json({ success: true, message: Const.Msg.DelOK });
            });
        });

    //////////examination//////////
    apiRouter.route('/examconfigs')
        //Return all records, generally used for association//chưa biết dùng làm gì
        .get(function (req, res) {
            //Ascending name by default
            ExamConfig.find({}).sort({ name: 1 }).exec(function (err, data) {
                if (err) return res.send(err);
                res.json(data);
            });
        })

        //Used to query the number of records under the specified conditions
        .patch(function (req, res) {
            //if(!ServerLogger.allowed('user','view', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            var criteria = {};
            if (req.body.criteria) {
                criteria = req.body.criteria;
            }

            //console.log('roles patch with criteria = ', criteria);
            ExamConfig.count(criteria).exec(function (err, count) {
                if (err) return res.send(err);
                //console.log('get userCount : ', userCount);
                res.json({ success: true, count: count });
            });
        })

        //Used to query data collections by page
        .put(function (req, res) {
            //if(!ServerLogger.allowed('user','view', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            //Query data collection, here are pages to query, so need to consider four parameters
            // currentPage，pageSize，criteriaFilter，criteriaSort
            //Default parameter settings
            var criteriaFilter = {};
            if (req.body.criteriaFilter) {
                criteriaFilter = req.body.criteriaFilter;
            }

            var criteriaSort = { name: 1 };
            if (req.body.criteriaSort) {
                criteriaSort = req.body.criteriaSort;
            }

            if (req.body.currentPage && req.body.pageSize) {
                var skip = req.body.currentPage;
                var pageSize = req.body.pageSize;
                //Calculate the number of documents that need to be skipped
                skip = (skip - 1) * pageSize;
                ExamConfig.find(criteriaFilter)
                    .populate('sheet', 'name')
                    .sort(criteriaSort).skip(skip).limit(pageSize).exec(function (err, data) {
                        if (err) return res.send(err);

                        //The status of the exam is determined according to the current time. Since the client's time is inaccurate, the server's time must be unified.
                        //The status of the exam is sent to the client
                        var now = new Date();
                        var begin;
                        for (var i in data) {
                            //Examination status is only available for exams that have already been published.
                            if (data[i].isPublic) {
                                //The status of the exam is only three, not started, the exam, and the end, depending on where the current time is before the start time and the end time.
                                if (data[i].dateEnd < now)
                                    data[i]._doc.status = '已结束';//over
                                else {//Start time needs to consider the number of minutes in advance
                                    if (now < data[i].dateBeginAhead)
                                        data[i]._doc.status = '未开始';//has not started
                                    else
                                        data[i]._doc.status = '考试中';//Examination
                                }
                            }
                        }

                        res.json(data);
                    });
            } else {
                //No paging information, return all data records directly
                ExamConfig.find(criteriaFilter).sort(criteriaSort).exec(function (err, data) {
                    if (err) return res.send(err);
                    res.json(data);
                });
            }
        })

        //Used to add records
        .post(function (req, res) {
            //if(!ServerLogger.allowed('user','create', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            var codeType = 'examconfig';
            var _id;
            //Save the new question is divided into three steps, first obtain the maximum number of questions, then save, and finally update the maximum number
            Promise.resolve()
                .then(function () {
                    //1. Maximum number of queries
                    return System.findOne({ codeType: codeType }, { maxNo: 1 });
                })
                .then(function (data) {
                    if (!data || !data.maxNo)
                        return Promise.reject('Failed to query the maximum number of test questions');
                    //2.Use this number to set the data's code field
                    var user = new ExamConfig();
                    user.code = utils.generateCode(codeType, data.maxNo);
                    user.name = req.body.name;
                    user.sheet = req.body.sheet;
                    user.dateBegin = req.body.dateBegin;
                    user.dateEnd = req.body.dateEnd;
                    user.ipPattern = req.body.ipPattern;
                    user.ipPatternB = utils.formatIpPattern(req.body.ipPattern);
                    user.minAhead = req.body.minAhead;
                    user.numTemplate = req.body.numTemplate;
                    user.pattern = req.body.pattern;
                    user.canReview = req.body.canReview;
                    user.isFull = req.body.isFull;
                    user.autoCorrect = req.body.autoCorrect;
                    user.lastModified = new Date();
                    if (req.body.hasOwnProperty('remark')) user.remark = req.body.remark;
                    return user.save();
                })
                .then(function (data) {
                    if (!data) //The return of save is a new object
                        return Promise.reject('Failed to save new question');
                    _id = data._id;
                    //Update number
                    return System.update({ codeType: codeType }, { $inc: { 'maxNo': 1 } });

                })
                .then(function (data) {
                    if (!data || !data.ok) //Update $inc returns {n:1, nModified:1, ok:1}
                        return Promise.reject('Failed to update the maximum number');
                    ServerLogger.log(req.decoded._id, req.path, req.method, req.body, req.path + _id);
                    res.json({ success: true, message: Const.Msg.AddOK, _id: _id });
                    return Promise.resolve();
                })
                .catch(function (error) {
                    res.send(error);
                })
                ;
        });

    ////////////////////////////////////////
    //Request for test setup operation//chưa biết làm gì
    ////////////////////////////////////////
    apiRouter.route('/examconfigsop/:_id')
        // update status
        .put(function (req, res) {
            //Do not do rights processing for now
            //if(!ServerLogger.allowed('user','update', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            ExamConfig.findById(req.params._id, function (err, user) {
                if (err) return res.send(err);
                var date = new Date();
                if (req.body.hasOwnProperty('isGenerated')) {
                    user.isGenerated = req.body.isGenerated;
                    user.dateGenerated = date;
                    if (!user.isGenerated)
                        user.dateGenerated = null;
                }
                if (req.body.hasOwnProperty('isPublic')) {
                    user.isPublic = req.body.isPublic;
                    user.datePublic = date;
                }
                user.lastModified = date;
                user.save(function (err) {
                    //console.log('error = ',err);
                    if (err)
                        return res.send(err);
                    ServerLogger.log(req.decoded._id, req.path, req.method, req.body);
                    res.json({ success: true, message: Const.Msg.UpdateOK, date: date });
                });

            });
        })

        //The collection of test papers used in test statistics only requires candidates, handing in, scoring, and score information
        .get(function (req, res) {
            Exam.find({ config: req.params._id }, {
                score: 1, isSubmit: 1, dateSubmit: 1, isCorrected: 1
                , dateCorrect: 1, tester: 1
            })
                .populate('tester', 'code name')
                .exec(function (err, data) {
                    if (err) return res.send(err);
                    res.json({ data: data, success: true });
                });

        })

        //IP examination for examination papers to participate in examinations and examinations
        .patch(function (req, res) {
            Exam.find({ config: req.params._id })
                .populate('tester', 'name code')
                .select('tester score dateSubmit dateRead submitIP readIP isRead isSubmit')
                .exec(function (err, data) {
                    if (err) return res.send(err);
                    res.json({ success: true, data: data });
                });
        })
        ;

    ////////////////////////////////////////
    apiRouter.route('/examconfigs/:_id')//chưa biết làm gì
        .get(function (req, res) {
            ExamConfig.findById(req.params._id, function (err, user) {
                if (err)
                    return res.send(err);
                res.json({ data: user, success: true });
            });
        })

        //The number of test papers used to query the current test settings
        .patch(function (req, res) {
            Exam.count({ config: req.params._id }).exec(function (err, count) {
                if (err) return res.send(err);
                //console.log('get userCount : ', userCount);
                res.json({ success: true, count: count });
            });
        })

        // Update specified id user information
        .put(function (req, res) {
            //Do not do rights processing for now
            //if(!ServerLogger.allowed('user','update', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            ExamConfig.findById(req.params._id, function (err, user) {
                if (err) return res.send(err);
                if (req.body.name) user.name = req.body.name;
                if (req.body.sheet) user.sheet = req.body.sheet;
                if (req.body.dateBegin) user.dateBegin = req.body.dateBegin;
                if (req.body.dateEnd) user.dateEnd = req.body.dateEnd;
                user.minAhead = req.body.minAhead;
                user.lastModified = new Date();
                if (req.body.pattern) user.pattern = req.body.pattern;
                if (req.body.numTemplate) user.numTemplate = req.body.numTemplate;
                if (req.body.hasOwnProperty('canReview')) user.canReview = req.body.canReview;
                if (req.body.hasOwnProperty('isFull')) user.isFull = req.body.isFull;
                if (req.body.hasOwnProperty('remark')) user.remark = req.body.remark;
                if (req.body.hasOwnProperty('ipPattern')) {
                    user.ipPattern = req.body.ipPattern;
                    user.ipPatternB = utils.formatIpPattern(req.body.ipPattern);
                }
                if (req.body.hasOwnProperty('autoCorrect')) user.autoCorrect = req.body.autoCorrect;

                user.save(function (err) {
                    //console.log('error = ',err);
                    if (err)
                        return res.send(err);
                    ServerLogger.log(req.decoded._id, req.path, req.method, req.body);
                    res.json({ success: true, message: Const.Msg.UpdateOK });
                });

            });
        })

        // Delete the specified user
        .delete(function (req, res) {
            //if(!ServerLogger.allowed('user','delete', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            ExamConfig.remove({
                _id: req.params._id
            }, function (err, user) {
                if (err)
                    return res.send(err);
                ServerLogger.log(req.decoded._id, req.path, req.method, { _id: req.params._id });
                res.json({ success: true, message: Const.Msg.DelOK });
            });
        })

        //Delete test papers that have been generated from the test setup and are ready to be regenerated
        .post(function (req, res) {
            Exam.remove({
                config: req.params._id
            }, function (err) {
                if (err)
                    return res.send(err);
                ServerLogger.log(req.decoded._id, req.path, req.method, { _id: req.params._id });
                res.json({ success: true, message: Const.Msg.DelOK });
            });
        })
        ;

    ///////////////////////////////////////////
    //Test paper//chưa biết làm gì
    apiRouter.route('/exams')
        //Used to query the number of records under the specified conditions
        .patch(function (req, res) {
            //if(!ServerLogger.allowed('user','view', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            var criteria = {};
            if (req.body.criteria) {
                criteria = req.body.criteria;
            }

            /**
             * Test papers may have several special query conditions
             * Possible parameters are:
             *  config          Test ID Array
             *  configStatus    Examination status array
             *  point           Total score range
             *  submitStatus    Examination result status array
             *  testerKey       Candidate Student ID or Name Match Keyword
             */
            Promise.resolve()
                .then(function () { //All exam IDs that the query needs to satisfy
                    //The test paper can only view the published test paper, so here we need to query all the test IDs that have been issued as the conditions of the query.
                    var cr = {};
                    //In addition to re-generating test papers, the number of queries submitted has been
                    //All other inquiry papers require the test paper to be released
                    //Modify to allow administrators to view unpublished but generated test papers
                    if (!req.body.isRegenerating) {
                        if (criteria.hasOwnProperty('isPublic')) {
                            cr.isPublic = criteria.isPublic;
                            delete criteria.isPublic;
                        }
                    }

                    //Is there a condition for screening exam Id
                    if (criteria.hasOwnProperty('config')) {
                        cr['_id'] = criteria.config;

                        //Temporarily remove from the query
                        delete criteria.config;
                    }

                    //Do you want to filter the status of the exam?
                    if (criteria.hasOwnProperty('configStatus')) {
                        var now = new Date();
                        if (criteria.configStatus && criteria.configStatus['$in']) {
                            var statuss = criteria.configStatus['$in'];
                            //A query condition
                            if (statuss.length == 1) {
                                if (statuss[0] == '未开始') {//has not started
                                    cr['dateBeginAhead'] = { '$gt': now };
                                } else if (statuss[0] == '已结束') {//over
                                    cr['dateEnd'] = { '$lt': now };
                                } else if (statuss[0] == '考试中') {//Examination
                                    cr['dateEnd'] = { '$gt': now };
                                    cr['dateBeginAhead'] = { '$lt': now };
                                }
                            } else if (statuss.length == 2) {
                                //Two query conditions
                                if (statuss.indexOf('未开始') < 0) {//has not started
                                    //Excluded does not start, it means that the test has been completed and has ended, that is, the current time after the test start time
                                    cr['dateBeginAhead'] = { '$lt': now };
                                } else if (statuss.indexOf('已结束') < 0) {//over
                                    //If the end of the exam is not included, it means that the exam has not started and the exam is in two kinds, that is, the exam end time is greater than the current time
                                    cr['dateEnd'] = { '$gt': now };
                                } else if (statuss.indexOf('考试中') < 0) {//Examination
                                    //Excluding exams, it means either it has ended or it has not yet begun
                                    cr['dateEnd'] = { '$lt': now };
                                    cr['dateBeginAhead'] = { '$gt': now };
                                }
                            }
                        }

                        //Remove from query conditions
                        delete criteria.configStatus;
                    }

                    //Do you want to filter the release status of the exam?
                    if (criteria.hasOwnProperty('publicStatus')) {
                        if (criteria.publicStatus && criteria.publicStatus['$in']) {
                            var statuss = criteria.publicStatus['$in'];
                            //A query condition
                            if (statuss.length == 1) {
                                if (statuss[0] == '已发布') {//Published
                                    cr['isPublic'] = true;
                                } else if (statuss[0] == '未发布') {//Unpublished
                                    cr['isPublic'] = false;
                                }
                            }
                        }

                        //Remove from query conditions
                        delete criteria.publicStatus;
                    }

                    return ExamConfig.find(cr, { _id: 1 });
                })
                .then(function (data) {//Splicing into query conditions
                    var ps = [];
                    for (var i in data) {
                        ps.push(data[i]._id);
                    }
                    criteria.config = { $in: ps };

                    //Is there a screening for students
                    if (criteria.hasOwnProperty('testerKey')) {
                        //The query condition is the student's ID or name contains the filter keyword
                        return User.find({ '$or': [{ 'code': criteria.testerKey }, { 'name': criteria.testerKey }] }, { _id: 1 });
                    }
                    else return Promise.resolve();
                })
                .then(function (data) {
                    if (criteria.hasOwnProperty('testerKey')) {
                        //Remove from query conditions
                        delete criteria.testerKey;
                    }
                    if (data) {
                        //There are matching student results
                        var ps = [];
                        for (var i in data) {
                            ps.push(data[i]._id);
                        }
                        criteria.tester = { $in: ps };
                    }

                    //Is there a requirement for the examination papers and status
                    if (criteria.hasOwnProperty('submitStatus')) {
                        //Conversions to both isSubmit and isCorrected
                        //'Undelivered volume', 'Offered, Undetermined', 'Approved'
                        if (criteria.submitStatus && criteria.submitStatus['$in']) {
                            var statuss = criteria.submitStatus['$in'];
                            //A query condition
                            if (statuss.length == 1) {
                                if (statuss[0] == '未交卷') {//Unpaid
                                    criteria['isSubmit'] = false;
                                } else if (statuss[0] == '已判卷') {//Sentenced
                                    criteria['isCorrected'] = true;
                                } else if (statuss[0] == '已交卷，未判卷') {//Has been handed in, but has not yet delivered
                                    criteria['isCorrected'] = false;
                                    criteria['isSubmit'] = true;
                                }
                            } else if (statuss.length == 2) {
                                //Two query conditions
                                if (statuss.indexOf('未交卷') < 0) {//Unpaid
                                    //Excluding unpaid rolls
                                    criteria['isSubmit'] = true;
                                } else if (statuss.indexOf('Sentenced') < 0) {
                                    //Excluding already sentenced
                                    criteria['isCorrected'] = false;
                                } else if (statuss.indexOf('已交卷，未判卷') < 0) {//Has been handed in, but has not yet delivered
                                    //Excluding remitted papers, no papers are counted, that is, they have to be handed in and scored.
                                    criteria['$or'] = [{ isSubmit: false }, { isSubmit: true, isCorrected: true }];
                                }
                            }
                        }

                        delete criteria.submitStatus;
                    }
                    //Query matching records
                    return Exam.count(criteria);
                })
                .then(function (data) {//The result of processing the number of queries
                    return res.json({ success: true, count: data });
                })
                .catch(function (err) {
                    if (err) return res.send(err);
                    return res.send('');
                })
                ;
        })

        //Used to query data collections by page
        .put(function (req, res) {
            //if(!ServerLogger.allowed('user','view', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            //Query data collection, here are pages to query, so need to consider four parameters
            // currentPage，pageSize，criteriaFilter，criteriaSort
            //Default parameter settings
            var criteria = {};
            if (req.body.criteriaFilter) {
                criteria = req.body.criteriaFilter;
            }
            //The test paper can only view the published test paper, so here we need to query all the test IDs that have been issued as the conditions of the query.
            Promise.resolve()
                .then(function () { //Query all test IDs that have been published
                    //The test paper can only view the published test paper, so here we need to query all the test IDs that have been issued as the conditions of the query.
                    var cr = {};
                    if (criteria.hasOwnProperty('isPublic')) {
                        cr.isPublic = criteria.isPublic;
                        delete criteria.isPublic;
                    }

                    //Is there a condition for screening exam Id
                    if (criteria.hasOwnProperty('config')) {
                        cr['_id'] = criteria.config;

                        //Temporarily remove from the query
                        delete criteria.config;
                    }

                    //Do you want to filter the status of the exam?
                    if (criteria.hasOwnProperty('configStatus')) {
                        var now = new Date();
                        if (criteria.configStatus && criteria.configStatus['$in']) {
                            var statuss = criteria.configStatus['$in'];
                            //A query condition
                            if (statuss.length == 1) {
                                if (statuss[0] == '未开始') {//has not started
                                    cr['dateBeginAhead'] = { '$gt': now };
                                } else if (statuss[0] == '已结束') {//over
                                    cr['dateEnd'] = { '$lt': now };
                                } else if (statuss[0] == '考试中') {//Examination
                                    cr['dateEnd'] = { '$gt': now };
                                    cr['dateBeginAhead'] = { '$lt': now };
                                }
                            } else if (statuss.length == 2) {
                                //Two query conditions
                                if (statuss.indexOf('未开始') < 0) {//has not started
                                    //Excluded does not start, it means that the test has been completed and has ended, that is, the current time after the test start time
                                    cr['dateBeginAhead'] = { '$lt': now };
                                } else if (statuss.indexOf('已结束') < 0) {//over
                                    //If the end of the exam is not included, it means that the exam has not started and the exam is in two kinds, that is, the exam end time is greater than the current time
                                    cr['dateEnd'] = { '$gt': now };
                                } else if (statuss.indexOf('考试中') < 0) {//Examination
                                    //Excluding exams, it means either it has ended or it has not yet begun
                                    cr['dateEnd'] = { '$lt': now };
                                    cr['dateBeginAhead'] = { '$gt': now };
                                }
                            }
                        }

                        //Remove from query conditions
                        delete criteria.configStatus;
                    }

                    //Do you want to filter the release status of the exam?
                    if (criteria.hasOwnProperty('publicStatus')) {
                        if (criteria.publicStatus && criteria.publicStatus['$in']) {
                            var statuss = criteria.publicStatus['$in'];
                            //A query condition
                            if (statuss.length == 1) {
                                if (statuss[0] == '已发布') {//Published
                                    cr['isPublic'] = true;
                                } else if (statuss[0] == '未发布') {//Unpublished
                                    cr['isPublic'] = false;
                                }
                            }
                        }

                        //Remove from query conditions
                        delete criteria.publicStatus;
                    }
                    return ExamConfig.find(cr, { _id: 1 });
                })
                .then(function (data) {//Splicing into query conditions
                    var ps = [];
                    for (var i in data) {
                        ps.push(data[i]._id);
                    }
                    criteria.config = { $in: ps };

                    //Is there a screening for students
                    if (criteria.hasOwnProperty('testerKey')) {
                        //The query condition is the student's ID or name contains the filter keyword
                        return User.find({ '$or': [{ 'code': criteria.testerKey }, { 'name': criteria.testerKey }] }, { _id: 1 });
                    }
                    else return Promise.resolve();
                })
                .then(function (data) {
                    if (criteria.hasOwnProperty('testerKey')) {
                        //Remove from query conditions
                        delete criteria.testerKey;
                    }
                    if (data) {
                        //There are matching student results
                        var ps = [];
                        for (var i in data) {
                            ps.push(data[i]._id);
                        }
                        criteria.tester = { $in: ps };
                    }

                    //Is there a requirement for the examination papers and status
                    if (criteria.hasOwnProperty('submitStatus')) {
                        //Conversions to both isSubmit and isCorrected
                        //'Undelivered volume', 'Offered, Undetermined', 'Approved'
                        if (criteria.submitStatus && criteria.submitStatus['$in']) {
                            var statuss = criteria.submitStatus['$in'];
                            //A query condition
                            if (statuss.length == 1) {
                                if (statuss[0] == '未交卷') {//Unpaid
                                    criteria['isSubmit'] = false;
                                } else if (statuss[0] == '已判卷') {//Sentenced
                                    criteria['isCorrected'] = true;
                                } else if (statuss[0] == '已交卷，未判卷') {//Has been handed in, but has not yet delivered
                                    criteria['isCorrected'] = false;
                                    criteria['isSubmit'] = true;
                                }
                            } else if (statuss.length == 2) {
                                //Two query conditions
                                if (statuss.indexOf('未交卷') < 0) {//Unpaid
                                    //Excluding unpaid rolls
                                    criteria['isSubmit'] = true;
                                } else if (statuss.indexOf('已判卷') < 0) {//Sentenced
                                    //Excluding already sentenced
                                    criteria['isCorrected'] = false;
                                } else if (statuss.indexOf('已交卷，未判卷') < 0) {//Has been handed in, but has not yet delivered
                                    //Excluding remitted papers, no papers are counted, that is, they have to be submitted, and they have to hand in and decide
                                    criteria['$or'] = [{ isSubmit: false }, { isSubmit: true, isCorrected: true }];
                                }
                            }
                        }

                        delete criteria.submitStatus;
                    }

                    var criteriaSort = { tester: 1 };

                    if (req.body.currentPage && req.body.pageSize) {
                        var skip = req.body.currentPage;
                        var pageSize = req.body.pageSize;
                        //Calculate the number of documents that need to be skipped
                        skip = (skip - 1) * pageSize;
                        return Exam.find(criteria, {
                            config: 1, tester: 1, score: 1, point: 1, dateGenerated: 1
                            , dateSubmit: 1, submitIP: 1, isSubmit: 1, isCorrected: 1, dateCorrect: 1
                        })
                            .populate('config', 'name isPublic canReview dateBeginAhead dateEnd dateBegin minAhead')
                            .populate('tester', 'name code')
                            .sort(criteriaSort).skip(skip).limit(pageSize);
                    } else {
                        //No paging information, return all data records directly
                        return Exam.find(criteria).sort(criteriaSort);
                    }
                })
                .then(function (data) {//Processing query results
                    //Update the status of the exam based on the current time
                    var now = new Date();
                    for (var i in data) {
                        //The status of the exam is only three, not started, the exam, and the end, depending on where the current time is before the start time and the end time.
                        if (data[i].config.dateEnd < now)
                            data[i]._doc.config._doc.status = '已结束';//over
                        else {//Start time needs to consider the number of minutes in advance
                            if (now < data[i].config.dateBeginAhead)
                                data[i]._doc.config._doc.status = '未开始';//has not started
                            else
                                data[i]._doc.config._doc.status = '考试中';//Examination
                        }
                    }

                    return res.json(data);
                })
                .catch(function (err) {
                    if (err) return res.send(err);
                    return res.send('');
                })
                ;


        })

        //Used to add records, this process can only be triggered by the actions that generated the test paper
        .post(function (req, res) {
            //if(!ServerLogger.allowed('user','create', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            var user = new Exam();
            user.config = req.body.config;
            user.tester = req.body.tester;
            user.point = req.body.point;
            user.questions = req.body.questions;
            user.ansExpect = req.body.ansExpect;
            user.dateGenerated = Date.now();

            //console.log('ready to create a new supplier:', supplier);
            //console.log('pinyin of ', supplier.name, ' = ', Pinyin.getFullChars(supplier.name));
            user.save(function (err) {
                if (err) {
                    return res.send(err);
                }
                ServerLogger.log(req.decoded._id, req.path, req.method, req.body, req.path + user._id);
                res.json({ success: true, message: Const.Msg.AddOK });
            });
        });

    ////////////////////////////////////////
    apiRouter.route('/exams/:_id')
        // Get information for the specified test paper
        .patch(function (req, res) {
            Exam.findById(req.params._id)
                .populate('config', 'name dateEnd dateBegin dateBeginAhead canReview ipPattern ipPatternB')
                .populate('tester', 'name code')
                .exec(function (err, user) {
                    if (err)
                        return res.send(err);
                    if (!user)
                        return res.send('Specified test paper does not exist，id=' + req.params._id);

                    var ip = utils.getClientIP(req);
                    //Calculate the status of the exam
                    var now = new Date();
                    //The status of the exam is only three, not started, the exam, and the end, depending on where the current time is before the start time and the end time.
                    if (user.config.dateEnd < now)
                        user._doc.config._doc.status = '已结束';//over
                    else {//Start time needs to consider the number of minutes in advance
                        if (now < user.config.dateBeginAhead)
                            user._doc.config._doc.status = '未开始';//has not started
                        else
                            user._doc.config._doc.status = '考试中';//Examination
                    }

                    /** See if you have permission to view the test paper and prevent the user from obtaining test paper content by directly entering the URL
                     * 1. Except the administrator has the right to view the test paper, other people can only view their own papers
                     * 2. The examination must be completed when the examination paper is viewed, and the examination is set to be rewindable
                     * 3. You must take the exam while you take the exam
                     * 4. All other situations return error messages.
                     */
                    if (req.decoded.code != 'admin') {
                        if (req.decoded._id != user.tester._id)
                            return res.send({ message: `Not allowed to view other people's papers` });
                        if (req.body.type == 'view') {
                            if (!user.config._doc.canReview) {
                                return res.send({ message: 'The paper does not open rewind function' });
                            } else if (user._doc.config._doc.status != '已结束')//over
                                return res.send({ message: 'View the test paper only after the test is over' });
                        } else if (req.body.type == 'test') {
                            if (user._doc.config._doc.status != '考试中')//Examination
                                return res.send({ message: 'Current exam status is not allowed to take the exam [status=' + user._doc.config._doc.status + ']' });
                            /** The test paper is allowed to open only once. If it is opened more than the second time, an error message is displayed.*/
                            if (user.isRead)
                                return res.send({ message: 'This set of papers has been answered by others and cannot be repeated[ ' + user.readIP + ', ' + user.dateRead + ']' });
                            /** Candidates who have already submitted papers cannot answer questions twice */
                            if (user.isSubmit)
                                return res.send({ message: 'The set of papers has been handed over and cannot be answered again[ ' + user.submitIP + ', ' + user.dateSubmit + ']' });
                            /** ip an examination */
                            var pattern = user._doc.config._doc.ipPatternB;
                            if (pattern) {
                                if (!utils.parseIP(ip, new RegExp(pattern, 'g')))
                                    return res.send({ message: 'Illegal IP:' + ip + ' [' + user._doc.config._doc.ipPattern + ']' });
                            }
                        } else
                            return res.send({ message: 'Unsupported paper acquisition mode:' + JSON.stringify(req.body) });
                    }

                    if (req.body.type == 'test') {
                        /** If it is an exam, the logo has been given the test paper's logo, prohibiting multiple questions */
                        Exam.update({ _id: req.params._id }, {
                            $set: {
                                isRead: true, readIP: ip, dateRead: new Date()
                            }
                        }).exec(function (err, result) {
                            return res.json({ data: user, success: true });
                        });
                    } else
                        return res.json({ data: user, success: true });
                });
        })

        // Update the specified test papers for students to submit
        .put(function (req, res) {
            //Do not do rights processing for now
            //if(!ServerLogger.allowed('user','update', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});
            var autoCorrect = false;

            //opType operation type, if correct, indicates manual batch or re-rolling
            var opType = req.body.opType;

            Promise.resolve()
                .then(function () {
                    if (opType == 'correct')
                        return Promise.resolve();
                    if (req.body.hasOwnProperty('ansSubmit')) {
                        return Promise.resolve();
                    }
                    return Promise.reject('No test data available');
                })
                .then(function () {
                    if (opType == 'correct')
                        return Promise.resolve();
                    //The first step is to check whether the test paper needs to be automatically judged
                    return Exam.findById(req.params._id)
                        .select('tester config')
                        .populate('config', 'autoCorrect');
                })
                .then(function (data) {
                    if (opType == 'correct') {
                        autoCorrect = true;
                        return Exam.findById(req.params._id)
                            .populate('ansExpect.qid', 'point type');
                    }
                    //Checking legality
                    if (req.decoded._id == data.tester) {
                        autoCorrect = data.config.autoCorrect;
                        //if(autoCorrect)
                        //    //Complete different search tasks based on whether automatic scoring is required
                        //    return Exam.findById(req.params._id)
                        //        .populate('ansExpect.qid', 'point type');
                        //else
                        //Automatic scoring can be performed directly in Exam without association
                        return Exam.findById(req.params._id);
                    } else
                        return Promise.reject('Students can only submit their own test papers');
                })
                .then(function (exam) {
                    if (opType != 'correct') {
                        //Modify the operation
                        exam.ansSubmit = req.body.ansSubmit;
                        exam.isSubmit = true;
                        exam.dateSubmit = new Date();
                        exam.submitIP = utils.getClientIP(req);
                    }

                    //Need to automatically determine the volume?
                    if (autoCorrect) {
                        exam.score = exam.getScore();
                        exam.isCorrected = true;
                        exam.dateCorrect = new Date();
                    }

                    return exam.save();
                })
                .then(function () {
                    ServerLogger.log(req.decoded._id, req.path, req.method, req.body);
                    return res.json({ success: true, message: Const.Msg.UpdateOK });
                })
                .catch(function (error) {
                    return res.send('错误：' + JSON.stringify(error));
                });
        })

        //Modify the mark of the test paper
        .post(function (req, res) {
            Promise.resolve()
                .then(function () {
                    return Exam.update({ _id: req.params._id }, {
                        $set: {
                            isCorrected: false, dateCorrect: null, score: 0
                            , isSubmit: false, dateSubmit: null
                            , submitIP: null
                        }
                    });
                })
                .then(function (data) {
                    if (!data || data.ok != 1) //Return of update {n:1, nModified:1, ok:1}
                        return Promise.reject('Failed to modify the logo');
                    ServerLogger.log(req.decoded._id, req.path, req.method, req.body);
                    return res.json({ success: true, message: Const.Msg.UpdateOK });
                })
                .catch(function (error) {
                    return res.send('error:' + JSON.stringify(error));
                });
        })

        // Delete the specified user
        .delete(function (req, res) {
            //if(!ServerLogger.allowed('user','delete', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            Exam.remove({
                _id: req.params._id
            }, function (err, user) {
                if (err)
                    return res.send(err);
                ServerLogger.log(req.decoded._id, req.path, req.method, { _id: req.params._id });
                res.json({ success: true, message: Const.Msg.DelOK });
            });
        });

    //////////////Export the list of test papers////////////////////
    apiRouter.route('/exportExams')
        .put(function (req, res) {
            var criteria = req.body.filter;
            var user = req.body.user;

            // Students are allowed to export personal test papers
            if (user.code != 'admin') {
                criteria.tester = user._id;
            }

            // Match in the database
            Exam.find(criteria, { dateSubmit: 1, point: 1, config: 1, tester: 1, isSubmit: 1, score: 1, _id: 0 })
                .populate('tester config', 'name code name isPublic dateBegin dateEnd')
                .exec(function (err, data) {
                    if (err) {
                        console.log('Error find: ', err);
                        res.json({ success: false, message: 'Failed' });
                    } else {

                        // Further filter the data and concatenate the data strings that need to be exported
                        var dataString = 'Serial number\t exam name\t student number\t name\t cross status\t turnover time\t score\t total score\n';
                        var len = data.length;
                        for (var i = 0; i < len; i++) {

                            // Whether the exam is public or not, students are only allowed to view publicly available exam papers
                            if (user.code != 'admin') {
                                if (data[i].config.isPublic == false)
                                    continue;
                            }

                            // Start stitching
                            dataString += (i + 1) + '\t' +
                                ((data[i].config) ? data[i].config.name : '') + '\t' +
                                ((data[i].tester) ? data[i].tester.code : '') + '\t' +
                                ((data[i].tester) ? data[i].tester.name : '') + '\t' +
                                (data[i].isSubmit ? '是' : '否') + '\t' +//Yes-No
                                data[i].dateSubmit + '\t' +
                                data[i].score + '\t' +
                                data[i].point + '\n';
                        }

                        // Output to file, temporary files are named using time
                        var date = Date.now();
                        var path = config.exportDir + date + '.txt';
                        fs.writeFile(path, dataString, function (err) {
                            if (err) {
                                throw err;
                            } else {
                                res.json({ success: true, data: { name: date }, message: 'OK' });
                            }
                        });
                    }
                });
        });

    //////////Check in the object//////////
    apiRouter.route('/signgroups')
        //Return all records, generally used for association//chưa biết làm gì
        .get(function (req, res) {
            //Ascending name by default
            SignGroup.find({}).sort({ name: 1 }).exec(function (err, data) {
                if (err) return res.send(err);
                res.json(data);
            });
        })

        //Used to query the number of records under the specified conditions
        .patch(function (req, res) {
            //if(!ServerLogger.allowed('user','view', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            var criteria = {};
            if (req.body.criteria) {
                criteria = req.body.criteria;
            }

            //console.log('roles patch with criteria = ', criteria);
            SignGroup.count(criteria).exec(function (err, count) {
                if (err) return res.send(err);
                //console.log('get userCount : ', userCount);
                res.json({ success: true, count: count });
            });
        })

        //Used to query data collections by page
        .put(function (req, res) {
            //if(!ServerLogger.allowed('user','view', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            //Query data collection, here are pages to query, so need to consider four parameters
            // currentPage，pageSize，criteriaFilter，criteriaSort
            //Default parameter settings
            var criteriaFilter = {};
            if (req.body.criteriaFilter) {
                criteriaFilter = req.body.criteriaFilter;
            }

            var criteriaSort = { name: 1 };
            if (req.body.criteriaSort) {
                criteriaSort = req.body.criteriaSort;
            }

            if (req.body.currentPage && req.body.pageSize) {
                var skip = req.body.currentPage;
                var pageSize = req.body.pageSize;
                //Calculate the number of documents that need to be skipped
                skip = (skip - 1) * pageSize;
                SignGroup.find(criteriaFilter).sort(criteriaSort).skip(skip).limit(pageSize).exec(function (err, data) {
                    if (err) return res.send(err);
                    res.json(data);
                });
            } else {
                //No paging information, return all data records directly
                SignGroup.find(criteriaFilter).sort(criteriaSort).exec(function (err, data) {
                    if (err) return res.send(err);
                    res.json(data);
                });
            }
        })

        //Used to add records
        .post(function (req, res) {
            //if(!ServerLogger.allowed('user','create', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            var user = new SignGroup();
            user.name = req.body.name;
            user.pattern = req.body.pattern;
            if (req.body.hasOwnProperty('remark')) user.remark = req.body.remark;

            //console.log('ready to create a new supplier:', supplier);
            //console.log('pinyin of ', supplier.name, ' = ', Pinyin.getFullChars(supplier.name));
            user.save(function (err) {
                if (err) {
                    return res.send(err);
                }
                ServerLogger.log(req.decoded._id, req.path, req.method, req.body, req.path + user._id);
                res.json({ success: true, message: Const.Msg.AddOK });
            });
        });

    ////////////////////////////////////////
    apiRouter.route('/signgroups/:_id')
        // Get the specified user's information
        .get(function (req, res) {
            SignGroup.findById(req.params._id, function (err, user) {
                if (err)
                    return res.send(err);
                res.json({ data: user, success: true });
            });
        })

        /** Query the number of students matching the specified pattern
         *  Common matching patterns are:
         *  Several classes in the same profession     ^(20155611)
         *  Several classes in the same grade     ^(2015[5611|5511])
         *  Several classes in different grades  ^(20155611|20131608)
         */
        .patch(function (req, res) {
            if (req.body.pattern) {
                var criteria = { code: { $regex: req.body.pattern } };
                User.count(criteria).exec(function (err, count) {
                    if (err) return res.send(err);
                    res.json({ success: true, count: count });
                });
            } else
                res.json({ success: true, count: 0 });
        })

        /** Query array of student object IDs matching the specified pattern *///chưa biết làm gì
        .post(function (req, res) {
            if (req.body.pattern) {
                var criteria = { code: { $regex: req.body.pattern } };
                User.find(criteria).select('_id').exec(function (err, data) {
                    if (err) return res.send(err);
                    res.json({ success: true, data: data });
                });
            } else
                res.send({ message: 'No match pattern given' });
        })

        // Update specified id user information
        .put(function (req, res) {
            //Do not do rights processing for now
            //if(!ServerLogger.allowed('user','update', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            SignGroup.findById(req.params._id, function (err, user) {
                if (err) return res.send(err);
                if (req.body.name) user.name = req.body.name;
                if (req.body.pattern) user.pattern = req.body.pattern;
                if (req.body.hasOwnProperty('remark')) user.remark = req.body.remark;

                user.save(function (err) {
                    //console.log('error = ',err);
                    if (err)
                        return res.send(err);
                    ServerLogger.log(req.decoded._id, req.path, req.method, req.body);
                    res.json({ success: true, message: Const.Msg.UpdateOK });
                });

            });
        })

        // Delete the specified user
        .delete(function (req, res) {
            //if(!ServerLogger.allowed('user','delete', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            SignGroup.remove({
                _id: req.params._id
            }, function (err, user) {
                if (err)
                    return res.send(err);
                ServerLogger.log(req.decoded._id, req.path, req.method, { _id: req.params._id });
                res.json({ success: true, message: Const.Msg.DelOK });
            });
        });

    //////////Sign in////////////tạo kiểm tra
    apiRouter.route('/signs')
        //Return all records, generally used for association//chưa biết để làm gì
        .get(function (req, res) {
            //Ascending name by default
            Sign.find({}).sort({ create: -1 }).exec(function (err, data) {
                if (err) return res.send(err);
                res.json(data);
            });
        })

        //Used to query the number of records under the specified conditions
        .patch(function (req, res) {
            //if(!ServerLogger.allowed('user','view', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            var criteria = {};
            if (req.body.criteria) {
                criteria = req.body.criteria;
            }

            //console.log('roles patch with criteria = ', criteria);
            Sign.count(criteria).exec(function (err, count) {
                if (err) return res.send(err);
                res.json({ success: true, count: count });
            });
        })

        //Used to query data collections by page
        .put(function (req, res) {
            //if(!ServerLogger.allowed('user','view', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            var criteriaFilter = {};
            if (req.body.criteriaFilter) {
                criteriaFilter = req.body.criteriaFilter;
            }

            var criteriaSort = {};
            if (req.body.criteriaSort) {
                criteriaSort = req.body.criteriaSort;
            }

            if (req.body.currentPage && req.body.pageSize) {
                var skip = req.body.currentPage;
                var pageSize = req.body.pageSize;
                //Calculate the number of documents that need to be skipped
                skip = (skip - 1) * pageSize;
                Sign.find(criteriaFilter, {
                    name: 1, owner: 1, create: 1, remark: 1
                    , signgroup: 1, isClosed: 1, numExpected: 1, numReal: 1, numException: 1, history: 1
                })
                    .populate('owner signgroup')
                    .sort(criteriaSort).skip(skip).limit(pageSize).exec(function (err, data) {
                        if (err) return res.send(err);
                        res.json(data);
                    });
            } else {
                //No paging information, return all data records directly
                Sign.find(criteriaFilter, {
                    name: 1, owner: 1, create: 1, remark: 1
                    , signgroup: 1, isClosed: 1, numExpected: 1, numReal: 1, numException: 1, history: 1
                })
                    .sort(criteriaSort).exec(function (err, data) {
                        if (err) return res.send(err);
                        res.json(data);
                    });
            }
        })

        //Used to add records
        .post(function (req, res) {
            //if(!ServerLogger.allowed('user','create', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            var user = new Sign();
            user.name = req.body.name;
            user.owner = req.decoded._id;
            user.signgroup = req.body.signgroup;
            if (req.body.hasOwnProperty('remark')) user.remark = req.body.remark;

            user.history = [];
            user.history.unshift({ name: req.decoded._id, type: '发起' });//Initiate

            //All students who match the query object pattern
            var criteria = { code: { $regex: req.body.pattern } };
            User.find(criteria, { _id: 1 }).exec(function (err, students) {
                if (err) return res.send(err);

                //And record the number of arrivals
                user.numExpected = students.length;

                user.detail = [];
                if (students.length > 0)
                    //Insert these records, initialized as not checked in
                    for (var i in students) {
                        user.detail.push({ name: students[i]._id });
                    }

                //Save to database
                user.save(function (err) {
                    if (err) {
                        return res.send(err);
                    }
                    ServerLogger.log(req.decoded._id, req.path, req.method, req.body, req.path + user._id);
                    res.json({ success: true, message: Const.Msg.AddOK });
                });
            });
        });

    ////////////////////////////////////////////
    //////Student queries include their own check-in information
    ////////////////////////////////////////////
    apiRouter.route('/signstudent')
        .get(function (req, res) {
            var userId = req.decoded._id;
            var criteria = { 'detail.name': userId };
            Sign.find(criteria, {
                name: 1, create: 1, owner: 1, signgroup: 1, isClosed: 1, detail: 1
            }).populate('owner signgroup')
                .exec(function (err, data) {
                    if (err) return res.send(err);

                    //Transform the check-in data into a flat array, ie delete the detail array, and call the current user's data into the main document.
                    var newData = [];
                    for (var i in data) {
                        for (var j in data[i].detail) {
                            if (data[i].detail[j].name == userId) {
                                newData.push({
                                    _id: data[i]._id
                                    , name: data[i].name
                                    , create: data[i].create
                                    , owner: data[i].owner
                                    , signgroup: data[i].signgroup
                                    , isClosed: data[i].isClosed

                                    , status: data[i].detail[j].status
                                    , date: data[i].detail[j].date
                                    , remark: data[i].detail[j].remark
                                });
                                break;
                            }
                        }
                    }

                    res.json({ data: newData, success: true });
                });
        });

    ////////////////////////////////////////
    apiRouter.route('/signs/:_id')
        .get(function (req, res) {
            var criteria = { _id: req.params._id };
            Sign.find(criteria).populate('signgroup detail.name')
                .exec(function (err, data) {
                    if (err) return res.send(err);
                    if (!data || data.length < 1) return res.send('No data found');
                    res.json({ data: data[0], success: true });
                });
        })

        /** Refresh the statistics of this check-in */
        .patch(function (req, res) { //TODO
            Sign.findById(req.params._id, function (err, sign) {
                if (err) return res.send(err);

                //Statistics of actual check-ins and abnormal numbers
                //Complete statistical information, do not rely on statistics obtained from the database, where may not be allowed
                var numReal = 0;
                var numException = 0;
                for (var i in sign.detail) {
                    if (sign.detail[i].status) {
                        if (sign.detail[i].status == '未签到') {//Not checked in
                        } else if (sign.detail[i].status == '已签到') {//Checked in
                            numReal++;
                        } else {
                            console.log(numException, ' ', sign.detail[i].status);
                            numException++;
                        }
                    }
                }

                sign.numReal = numReal;
                sign.numException = numException;

                sign.save(function (err) {
                    if (err) return res.send(err);
                    res.json({ success: true, data: { numReal: numReal, numException: numException } });
                });
            });
        })

        // Update specified id user information
        .put(function (req, res) {
            var userId = req.decoded._id;
            var type = req.body.type;
            if (type != 'status' && type != 'sign' && type != 'exception')
                return res.json({ message: Const.Msg.NotSupported });
            //Modify the status of the check-in only admin has permission
            if ((type == 'exception' || type == 'status') && 'admin' !== req.decoded.code)
                return res.json({ message: Const.Msg.NotAuthenticated });

            /** Sign-in does not provide modification interface, the modification is mainly
             * status Modify the status of the check-in. The teacher closes a check-in or reopens a check-in.
             * exception Modify the state of a student to the specified state, need the status values ​​of student and status
             * sign     Students complete the check-in is also a way to modify
             * Here is a parameter type difference
             * */
            //tạm thời hơi hiểu
            Sign.findById(req.params._id, function (err, user) {
                if (err) return res.send(err);
                var found = false;
                if (type == 'exception') { //The teacher sets an abnormal state and marks the student as signing or asking for leave
                    var student = req.body.student;
                    var status = req.body.status;
                    var changeName = null;
                    for (var i in user.detail) {
                        //Match the ID number of the incoming Detail
                        if (user.detail[i]._id == student) {
                            var oldStatus = user.detail[i].status;
                            if (oldStatus != status) {
                                changeName = "set up id=" + student + " Status from " + oldStatus + ' To ' + status;

                                user.detail[i].status = status;
                                //After the management setting status, the user's IP value is empty
                                user.detail[i].ip = null;
                                user.detail[i].date = Date.now();
                                user.detail[i].remark = req.body.remark;
                                //Only the flag is changed, no statistics are calculated
                                user.numReal = -1;

                                user.history.unshift({ name: userId, type: changeName });
                                found = true;
                                break;
                            } else {
                                return res.json({ message: Const.Msg.NotSupported });
                            }
                        }
                    }
                } else if (type == 'status') { //The teacher sets the sign-in status, only two states switch back and forth
                    var changeName;
                    if (user.isClosed) {
                        changeName = '重新开启';//Reopen
                        user.isClosed = false;
                    } else {
                        changeName = '关闭';//shut down
                        user.isClosed = true;
                    }
                    user.history.unshift({ name: userId, type: changeName });
                    found = true;
                } else if (type == 'sign') { //Student sign in
                    //Closed check-ins can no longer add sign-in students.
                    if (user.isClosed)
                        return res.json({ message: Const.Msg.NotSupported });

                    //Find this student's record, modify its status and current time
                    for (var i in user.detail) {
                        //Match the current user's ID
                        if (user.detail[i].name == userId) {
                            if (user.detail[i].status == '未签到') {//Not checked in
                                user.detail[i].date = Date.now();
                                user.detail[i].status = '已签到';//Checked in

                                //Record the IP address when checking in
                                user.detail[i].ip = utils.getClientIP(req);

                                //Only the flag is changed, no statistics are calculated
                                user.numReal = -1;
                                found = true;
                                break;
                            } else {
                                return res.json({ message: Const.Msg.NotSupported });
                            }
                        }
                    }
                }

                if (found)
                    user.save(function (err) {
                        //console.log('error = ',err);
                        if (err)
                            return res.send(err);
                        ServerLogger.log(req.decoded._id, req.path, req.method, req.body);
                        res.json({ success: true, message: Const.Msg.UpdateOK });
                    });
                else
                    return res.json({ message: 'Did not match any data' });
            });
        })

        // Delete the specified user
        .delete(function (req, res) {
            //if(!ServerLogger.allowed('user','delete', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            Sign.remove({
                _id: req.params._id
            }, function (err, user) {
                if (err)
                    return res.send(err);
                ServerLogger.log(req.decoded._id, req.path, req.method, { _id: req.params._id });
                res.json({ success: true, message: Const.Msg.DelOK });
            });
        });

    // Get your own information
    apiRouter.get('/me', function (req, res) {
        //console.log('get /me with decoded = ', req.decoded);
        res.send(req.decoded);
    });

    //////////roles/////////////////////////////
    apiRouter.route('/roles')
        //Used to query the number of records under the specified conditions
        .patch(function (req, res) {
            //if(!ServerLogger.allowed('role','view', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});
            var criteria = {};
            if (req.body.criteria) {
                criteria = req.body.criteria;
            }
            //console.log('roles patch with criteria = ', criteria);
            Role.count(criteria)
                .exec(function (err, count) {
                    if (err) return res.send(err);
                    //console.log('get userCount : ', userCount);
                    res.json({ success: true, count: count });
                });
        })

        //Used to query data collections by page
        .put(function (req, res) {
            //if(!ServerLogger.allowed('role','view', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            //Query data collection, here are pages to query, so need to consider four parameters
            // currentPage，pageSize，criteriaFilter，criteriaSort
            //Default parameter settings
            var criteriaFilter = {};
            if (req.body.criteriaFilter) {
                criteriaFilter = req.body.criteriaFilter;
            }

            var criteriaSort = { code: 1 };
            if (req.body.criteriaSort) {
                criteriaSort = req.body.criteriaSort;
            }

            if (req.body.currentPage && req.body.pageSize) {
                var skip = req.body.currentPage;
                var pageSize = req.body.pageSize;
                //Calculate the number of documents that need to be skipped
                skip = (skip - 1) * pageSize;
                Role.find(criteriaFilter).sort(criteriaSort)
                    .skip(skip).limit(pageSize)
                    .exec(function (err, data) {
                        if (err) return res.send(err);
                        res.json(data);
                    });
            } else {
                //No paging information, return all data records directly
                Role.find(criteriaFilter).sort(criteriaSort)
                    .exec(function (err, data) {
                        if (err) return res.send(err);
                        res.json(data);
                    });
            }
        })

        //Return all records, generally used for association
        .get(function (req, res) {
            //Ascending name by default
            Role.find({}).sort({ _p_name: 1 })
                .exec(function (err, data) {
                    if (err) return res.send(err);
                    res.json(data);
                });
        })

        //Ascending name by default
        .post(function (req, res) {
            //if(!ServerLogger.allowed('role','create', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});
            var role = new Role();
            role.name = req.body.name;
            role.code = req.body.code;
            role.permits = req.body.permits;
            if (req.body.hasOwnProperty('remark'))
                role.remark = req.body.remark;

            //console.log('ready to create a new supplier:', supplier);
            //console.log('pinyin of ', supplier.name, ' = ', Pinyin.getFullChars(supplier.name));
            role.save(function (err) {
                if (err) {
                    if (err.code == 11000)
                        return res.json({ message: Const.Msg.Duplicate });
                    else
                        return res.send(err);
                }
                ServerLogger.log(req.decoded._id, req.path, req.method, req.body, req.path + role._id);
                res.json({ success: true, message: Const.Msg.AddOK });
            });
        });

    //////////role_id//////////////////////////////
    apiRouter.route('/roles/:role_id')
        .get(function (req, res) {
            Role.findById(req.params.role_id, function (err, role) {
                if (err) return res.send(err);
                res.json({ data: role, success: true });
            });
        })

        .put(function (req, res) {
            //if(!ServerLogger.allowed('role','update', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            Role.findById(req.params.role_id, function (err, role) {
                if (err) return res.send(err);
                if (req.body.name) role.name = req.body.name;
                if (req.body.code) role.code = req.body.code;
                if (req.body.hasOwnProperty('remark')) role.remark = req.body.remark;
                if (req.body.permits != undefined
                    && req.body.permits != null) role.permits = req.body.permits;
                var needUpdateUser = role.isModified('permits');
                role.save(function (err) {
                    if (err) return res.send(err);
                    ServerLogger.log(req.decoded._id, req.path, req.method, req.body);

                    //Update the user's permission value involved in this role
                    //The ideal place is automatically called in the pre method of the model, but the User model does not recognize the find, update method
                    //Can only be modified here.
                    if (needUpdateUser) {
                        //Set the filter user's criteria, only the role array contains the current role
                        //Target format: {role:ObjectId('5540c2bd1a7954c08eac655d')}
                        var criteria = { role: role._id };
                        var options = { multi: true, upsert: false };
                        //console.log('call update with criteria = ', criteria);
                        User.update(criteria, { $set: { __v: 0 } }, options, function (err, numberAffected, raw) {
                            if (err) return res.send(err);
                            //console.log('The number of updated documents was %d', numberAffected);
                            //console.log('The raw response from Mongo was ', raw);
                            res.json({ success: true, message: Const.Msg.UpdateOK });
                        });
                    } else
                        res.json({ success: true, message: Const.Msg.UpdateOK });
                });

            });
        })

        .delete(function (req, res) {
            //if(!ServerLogger.allowed('role','delete', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            //Deleting a role can be deleted only if no user has assigned this role. Otherwise, database inconsistency will occur.
            var criteria = { role: req.params.role_id };
            User.count(criteria).exec(function (err, count) {
                if (err)
                    res.send(err);
                else if (count == 0) {
                    Role.remove({
                        _id: req.params.role_id
                    }, function (err, role) {
                        if (err) return res.send(err);
                        ServerLogger.log(req.decoded._id, req.path, req.method, { _id: req.params.role_id });
                        res.json({ success: true, message: Const.Msg.DelOK });
                    });
                } else
                    res.json({ message: Const.Msg.DelRelatedObj });
            });
        });

    //////////files////////////////////////////////////////
    apiRouter.route('/files')
        //Statistics student's turnover
        .patch(function (req, res) {
            var beginDate = req.body.begin;
            var endDate = req.body.end;
            var pattern = req.body.pattern;
            console.log('pattern '+ pattern)
            //Construct query conditions {isFile:true, path:{$regex:'^./20138625'}, 'history.date':{$lt:ISODate("2016-03-08T00:00:00.000Z")}},{path:1,name:1,_id:0}
            var criteria = { isDelete: null, isFile: true, path: { $regex: '^./' + pattern } };
            //Last modification time
            if (endDate)
                criteria['lastModified'] = { $lt: endDate };
            if (beginDate) {
                if (criteria['lastModified'])
                    criteria['lastModified']['$gt'] = beginDate;
                else
                    criteria['lastModified'] = { $gt: beginDate };

            }

            //First check the number of matched students, which is the list of students who should be
            var cri = { code: { $regex: pattern } };
            User.find(cri, { _id: 1, name: 1, code: 1 }).exec(function (err, students) {
                if (err) return res.send(err);

                if (students.length > 0) {
                    var detail = {};
                    //Create a record for each student that should arrive. The default number of files submitted is 0.
                    for (var i in students) {
                        detail[students[i]._id] = { num: 0, info: students[i], file: [] };
                    }

                    //Execute the query again
                    File.find(criteria)
                        .select('fname fullname history')
                        .sort({ path: 1, name: 1 })
                        //.populate('history.name', 'name code')
                        .exec(function (err, data) {
                            if (err) return res.send(err);

                            //Count the total number of people and documents by student, and record the student number and name of each student, as well as the array of document IDs involved
                            //According to the start date, delete the latest date after the start date of the file
                            var numFile = 0;
                            var numStudent = 0;

                            var studentId;

                            var ip;
                            var uploadDate;

                            for (var i in data) {
                                //Found a matching file
                                numFile++;
                                studentId = data[i].history[0].name;

                                ip = null;
                                uploadDate = null;
                                //Find out the time and IP of the upload action from the history record and record it in the response file
                                for (var j = 0; j < data[i].history.length; j++) {
                                    if (data[i].history[j].type == 'upload') {
                                        ip = data[i].history[j].ip;
                                        uploadDate = data[i].history[j].date;
                                        break;
                                    }
                                }

                                try {
                                    //Record the total number of students who have submitted files
                                    if (detail[studentId].num < 1) {
                                        numStudent++;
                                    }
                                } catch (exp) {
                                    console.log('detail = ', detail);
                                    console.log('data[', i, '] = ', data[i]);
                                    console.log('i = ', i);
                                    console.log('studentId = ', studentId);
                                    console.log('detail[studentId] = ', detail[studentId]);
                                    console.log(exp);
                                }
                                //Cumulative quantity
                                detail[studentId].num++;

                                //Record file information
                                detail[studentId].file.push({ _id: data[i]._id, fname: data[i].fname, fullname: data[i].fullname, ip: ip, uploadDate: uploadDate });

                                /** Simultaneously mark the index of the most recently submitted file in each student's submission, primarily to sort the students who submitted the document
                                 Note that if each student submits more than one document, the last submission time will be the student's submission date.
                                 Sorting is sorted from front to back by time.
                                 **/
                                if (detail[studentId].num > 1) {
                                    //First move the last recorded file index back by one
                                    detail[studentId].lastIndex++;
                                    //  There are multiple files and you need to compare the time of the new file with the original file
                                    //  If the newly-found file upload time is later than the latest file upload time recorded, the newly discovered file will prevail.
                                    //  Otherwise unchanged
                                    if (uploadDate > detail[studentId].file[detail[studentId].lastIndex].uploadDate)
                                        detail[studentId].lastIndex = 0;
                                } else { //There is only one file, then the latest file is this one
                                    detail[studentId].lastIndex = 0;
                                }
                            }

                            //Construct the returned data structure
                            var newDetail = [];
                            for (var i in detail) {
                                newDetail.push(detail[i]);
                            }

                            var newData = { numStudent: numStudent, numFile: numFile, detail: newDetail };
                            res.json({ success: true, data: newData });
                        });
                } else {
                    res.json({ success: false, message: 'No match found[pattern="' + pattern + '"]' });
                }

            });
        })

        //Used to query data collections by page
        .put(function (req, res) {
            //The condition of the query folder is generally path, and occasionally has the isFile attribute, used to select the move destination
            var criteria = {};
            if (req.body.criteriaFilter) {
                criteria = req.body.criteriaFilter;
            } else //Default search root directory
                criteria = { path: '.', isDelete: 0 };
            //First check if the specified directory exists to prevent access to the directory that does not exist or has been renamed through the navigation history
            if (!criteria.path)
                return res.json({ message: 'Illegal request: The current path is not specified.' });
            //Processing Recycle Bin Data Requests
            if (criteria.path == 'recycle') {
                var time1 = 'Thu Jan 01 1970 08:00:00 GMT+0800 (China Standard Time)';
                var time2 = 'Thu Jan 01 1970 08:00:10 GMT+0800 (China Standard Time)';
                File.find({ isDelete: { $ne: time1 } }).exec(function (err, result) {
                    if (err)
                        return res.json({ message: err });
                    var backRes = [];
                    //Filter the results further and filter out deleted subfiles
                    result.forEach(function (file) {
                        if (file.isDelete != time2) {
                            backRes.push(file);
                        }
                    });
                    res.json({ data: backRes });
                });
            } else {
                //Handle filer data requests
                async.waterfall([function (callback) {
                    if (criteria.path.length > 1) {//Check outside the root directory
                        var pos = criteria.path.lastIndexOf('/');
                        console.log(pos)
                        if (pos > -1) {
                            var p = criteria.path.substring(0, pos);
                            var n = criteria.path.substring(pos + 1);
                            File.find({ path: p, name: n }).exec(function (err, data) {
                                if (err) callback(err);
                                console.log('data ' + data)
                                if (data && data.length > 0) {
                                    callback(null);
                                } else {
                                    callback('Illegal request : Specify path' + criteria.path + 'Does not exist, please check whether it has been deleted, renamed or moved, will automatically go to the root directory of the network .');
                                }
                            });
                        }
                    } else callback(null);
                },
                function (callback) {
                    //Sorting conditions are unique, first by directory file, then by name
                    var criteriaSort = { isFile: 1, _p_name: 1 };
                    if (req.body.selectColumns)
                        File.find(criteria).sort(criteriaSort).select(req.body.selectColumns).exec(function (err, data) {
                            if (err) callback(err);
                            callback(null, data);
                        });
                    else
                        File.find(criteria).sort(criteriaSort).exec(function (err, data) {
                            if (err) callback(err);
                            callback(null, data);
                        });
                }
                ], function (err, result) {
                    if (err) return res.json({ message: err });
                    res.json({ data: result });
                });
            }
        })

        //Used to add a directory
        .post(function (req, res) {
            var fo = new File();		// create a new instance of the User model
            fo.name = req.body.name;  // set the users name (comes from the request)
            fo.path = req.body.path;  // set the users username (comes from the request)
            fo.isFile = req.body.isFile;
            fo.extension = req.body.extension;
            fo.history = req.body.history;
            fo.save(function (err) {
                //console.log('create dir successfully');
                if (err) return res.send(err);
                res.json({ _id: fo._id, success: true, message: Const.Msg.AddOK });
            });
        });

    //////////file_id////////////////////////////////////////
    apiRouter.route('/files/:file_id')
        //Corresponding paste operation
        .patch(function (req, res) {
            var configFile = req.body.config;
            var id = req.params.file_id;
            File.find({ path: configFile.dest, fullname: configFile.fullname }).exec(function (err, data) {
                if (err) return res.send(err);
                if (data && data.length > 0) {
                    //There are duplicate names
                    if (configFile.isFile) {
                        if (configFile.skip || configFile.skipOnce)
                            return res.json({ success: true, message: 'skipped' });
                        if (configFile.overWrite || configFile.overWriteOnce) {
                            //Can cover
                            if (configFile.isCut) {
                                //Overwrite cut = Delete duplicate file, and then modify the current file path information
                                if (config.uploadRemoveReplaced) {
                                    //Delete overwritten files
                                    File.findById(data[0]._id, function (err, file) {
                                        fs.unlink(config.uploadDir + file.fname, function () {
                                            File.remove({
                                                _id: data[0]._id
                                            }, function (err, file) {
                                                if (err) return res.send(err);
                                                //db.t4.update({id:5},{$push:{queue:{$each:[{wk:0,score:0}],$position:0}}});
                                                File.update({ _id: id }, { $set: { path: configFile.dest }, $push: { history: { $each: [{ name: configFile.user, type: 'move', date: Date.now() }], $position: 0 } } }, options, function (err, numberAffected, raw) {
                                                    if (err) return res.send(err);
                                                    res.json({ _id: id, success: true, message: Const.Msg.UpdateOK });
                                                });
                                            });
                                        });
                                    });
                                } else
                                    //Keep overwritten files
                                    File.remove({
                                        _id: data[0]._id
                                    }, function (err, file) {
                                        if (err) return res.send(err);
                                        //db.t4.update({id:5},{$push:{queue:{$each:[{wk:0,score:0}],$position:0}}});
                                        File.update({ _id: id }, { $set: { path: configFile.dest }, $push: { history: { $each: [{ name: configFile.user, type: 'move', date: Date.now() }], $position: 0 } } }, options, function (err, numberAffected, raw) {
                                            if (err) return res.send(err);
                                            res.json({ _id: id, success: true, message: Const.Msg.UpdateOK });
                                        });
                                    });
                            } else {
                                //Overwrite Copy = Delete the original real file, copy the current real file, modify the fname and size attributes of the duplicate file
                                File.findById(id, function (err, file) {
                                    if (err) return res.send(err);
                                    if (config.uploadRemoveReplaced) {
                                        //Delete overwritten files
                                        fs.unlink(config.uploadDir + data[0].fname, function () {
                                            var neuName = utils.generateNewName(file.fullname);
                                            //Copy entity file
                                            utils.copyFile(config.uploadDir + file.fname, config.uploadDir + neuName);
                                            File.update({ _id: data[0]._id }, {
                                                $set: { fname: neuName, size: file.size },
                                                $push: {
                                                    history: {
                                                        $each: [{ name: configFile.user, type: 'copy', date: Date.now() }],
                                                        $position: 0
                                                    }
                                                }
                                            }, options, function (err, numberAffected, raw) {
                                                if (err) return res.send(err);
                                                res.json({
                                                    _id: data[0]._id,
                                                    success: true,
                                                    message: Const.Msg.UpdateOK
                                                });
                                            });
                                        });
                                    } else {
                                        //Keep overwritten files and generate new files directly
                                        var neuName = utils.generateNewName(file.fullname);
                                        //Copy entity file
                                        utils.copyFile(config.uploadDir + file.fname, config.uploadDir + neuName);
                                        File.update({ _id: data[0]._id }, { $set: { fname: neuName, size: file.size }, $push: { history: { $each: [{ name: configFile.user, type: 'paste', date: Date.now() }], $position: 0 } } }, options, function (err, numberAffected, raw) {
                                            if (err) return res.send(err);
                                            res.json({ _id: data[0]._id, success: true, message: Const.Msg.UpdateOK });
                                        });
                                    }
                                });
                            }
                        } else if (configFile.isBackup || configFile.needRename || configFile.needRenameOnce) {
                            //Allow rename
                            //Use Async to organize renamed effects
                            var foundUniqueName = false;
                            var neuFullName = '';
                            var stamName = data[0].name;
                            var neuName = stamName;
                            var extension = data[0].extension;
                            var uniqueSuffix = ' - 备份';
                            var nameIndex = 1;
                            //console.log('enter whilst to find a unique name based on ', (neuName+ '.'+ extension));
                            async.whilst(
                                function () { return !foundUniqueName; },
                                function (cb) {
                                    //Constantly add non-repeat suffixes to avoid duplicate names
                                    neuName = stamName + uniqueSuffix;
                                    if (nameIndex > 1) {
                                        neuName += '(' + nameIndex + ')';
                                    }
                                    neuFullName = neuName + '.' + extension;
                                    //console.log('check whether ', neuFullName, ' under path ',configFile.dest,' is duplicated?');
                                    File.find({ path: configFile.dest, fullname: neuFullName }).exec(function (err, data) {
                                        if (err) cb('MongoDB error ' + err);
                                        if (data && data.length > 0) {
                                            //There are duplicate names
                                            //console.log('repeat whilst = ' + neuName + ', ' + neuFullName);
                                            nameIndex++;
                                            cb();
                                        } else {
                                            foundUniqueName = true;
                                            cb('found unique name = ' + neuName + ', ' + neuFullName);
                                        }
                                    });
                                },
                                function (err) {
                                    //console.log('Exist whilst or error = ', err);
                                    //Find a file with no name, complete the paste of the file
                                    if (configFile.isCut) {
                                        //modify
                                        var options = { multi: false, upsert: false };
                                        File.update({ _id: id }, { $set: { path: configFile.dest, name: neuName }, $push: { history: { $each: [{ name: configFile.user, type: 'paste', date: Date.now() }], $position: 0 } } }, options, function (err, numberAffected, raw) {
                                            if (err) return res.send(err);
                                            res.json({ _id: id, success: true, message: Const.Msg.UpdateOK });
                                        });
                                    } else {
                                        //Copy, first find the original file, copy its real file (note the new name), then save a new record
                                        File.findById(id, function (err, file) {
                                            if (err) cb('MongoDB error ' + err);
                                            var neuName2 = utils.generateNewName(neuFullName);
                                            //Copy entity file
                                            utils.copyFile(config.uploadDir + file.fname, config.uploadDir + neuName2);
                                            //Save database records
                                            var f = new File();
                                            f.name = neuName;
                                            f.fname = neuName2;
                                            f.extension = file.extension;
                                            f.mimetype = file.mimetype;
                                            f.size = file.size;
                                            f.path = configFile.dest;
                                            f.encoding = file.encoding;
                                            f.history = [{ name: configFile.user, type: 'paste' }];
                                            f.save(function (err) {
                                                if (err) cb('MongoDB error ' + err);
                                                else res.json({ _id: f._id, success: true, message: Const.Msg.UpdateOK });
                                            });
                                        });
                                    }
                                }
                            );
                        } else {
                            //Need to return to the user to decide how to deal with duplicate names
                            res.json({ success: false, message: Const.Msg.Duplicate });
                        }
                    } else {
                        //The duplicate name of the directory is allowed. The duplicate file will merge the contents of the two folders unless the current directory is copied and pasted. This will automatically generate a backup directory.
                        // There are three main operations that use Async to synchronize:
                        // 1. Find out the Path and Fullname information of this directory,
                        // 2. Collect all file information of path=Path+Fullname. This is the information that needs to be returned.
                        // 3. If it is a cut operation, you also need to delete the original directory
                        var newId = data[0]._id;
                        var neuName = null;
                        async.waterfall([
                            function (callback) {
                                //Do you need to rename
                                if (configFile.isBackup) {
                                    //Find unique directory names for directories, add new directories
                                    var foundUniqueName = false;
                                    var stamName = data[0].name;
                                    neuName = stamName;
                                    var uniqueSuffix = ' - 备份';
                                    var nameIndex = 1;
                                    async.whilst(
                                        //Find out the process of not duplicating names
                                        function () { return !foundUniqueName; },
                                        function (cb) {
                                            //Constantly add non-repeat suffixes to avoid duplicate names
                                            neuName = stamName + uniqueSuffix;
                                            if (nameIndex > 1) {
                                                neuName += '(' + nameIndex + ')';
                                            }
                                            File.find({ path: configFile.dest, name: neuName, isFile: false }).exec(function (err, dataDuplicated) {
                                                if (err) cb('MongoDB error ' + err);
                                                else if (dataDuplicated && dataDuplicated.length > 0) {
                                                    //There are duplicate names
                                                    nameIndex++;
                                                    cb();
                                                } else {
                                                    foundUniqueName = true;
                                                    cb('found unique name = ' + neuName);
                                                }
                                            });
                                        },
                                        function (err) {
                                            //Find the name of the directory that is not renamed and complete the paste of the directory
                                            //It must be a copy here. The cut cannot happen in the current directory. First find out the original directory information, copy the information, and then save a new record.
                                            File.findById(id, function (err, file) {
                                                if (err) callback('MongoDB error ' + err);
                                                else {
                                                    //Save database records
                                                    var f = new File();
                                                    f.name = neuName;
                                                    f.extension = file.extension;
                                                    f.isFile = false;
                                                    f.path = configFile.dest;
                                                    f.history = [{ name: configFile.user, type: 'create' }];
                                                    f.save(function (err) {
                                                        if (err) callback('MongoDB error ' + err);
                                                        else {
                                                            newId = f._id;
                                                            callback(null);
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    );
                                } else
                                    callback(null);
                            },
                            function (callback) {
                                //Find the path and name of the original directory
                                File.find({ _id: id }).select('path name').exec(function (err, dataLocateDir) {
                                    if (err) callback('MongoDB error ' + err);
                                    else if (!dataLocateDir || dataLocateDir.length < 1) { callback('MongoDB error no matched found ' + id); }
                                    else callback(null, dataLocateDir[0].path, dataLocateDir[0].name);
                                });
                            },
                            function (path, name, callback) {
                                //Collect files and subdirectory information in the original directory
                                if (!neuName)
                                    //If the directory is not renamed, the original name is used
                                    neuName = name;
                                File.find({ path: path + '/' + name }).select('path fullname isFile').exec(function (err, data) {
                                    if (err) callback('MongoDB error ' + err);
                                    else callback(null, data);
                                });
                            },
                            function (data, callback) {
                                //When the directory cuts the duplicate name, delete the original directory
                                if (configFile.isCut) {
                                    File.remove({ _id: id }, function (err, file) {
                                        if (err) callback('MongoDB error ' + err);
                                        else callback(null, data);
                                    });
                                } else
                                    callback(null, data);
                            }
                        ], function (err, data) {
                            if (err) return res.send(err);
                            res.json({ _id: newId, neuDest: configFile.dest + '/' + neuName, data: data, success: true, message: Const.Msg.UpdateOK });
                        });
                    }
                } else {
                    //Do not repeat the name, perform a paste action
                    if (configFile.isFile) {
                        if (configFile.isCut) {
                            //Cut only need to modify the database information, no file operation
                            var criteria = { _id: id };
                            var options = { multi: false, upsert: false };
                            File.update(criteria, {
                                $set: { path: configFile.dest },
                                $push: { history: { $each: [{ name: configFile.user, type: 'cut', date: Date.now() }], $position: 0 } }
                            }, options, function (err, numberAffected, raw) {
                                if (err) return res.send(err);
                                res.json({ _id: id, success: true, message: Const.Msg.UpdateOK });
                            });
                        } else {
                            //Copy, first find the original file, copy its real file (note the new name), then save a new record
                            File.findById(id, function (err, file) {
                                if (err) return res.send(err);
                                var neuName = utils.generateNewName(file.fullname);
                                //Copy entity file
                                utils.copyFile(config.uploadDir + file.fname, config.uploadDir + neuName);
                                //Save database records
                                var f = new File();
                                f.name = file.name;
                                f.fname = neuName;
                                f.extension = file.extension;
                                f.mimetype = file.mimetype;
                                f.size = file.size;
                                f.path = configFile.dest;
                                f.encoding = file.encoding;
                                f.history = [{ name: configFile.user, type: 'paste' }];
                                f.save(function (err) {
                                    if (err) res.send(err);
                                    else res.json({ _id: f._id, success: true, message: Const.Msg.UpdateOK });
                                });
                            });
                        }
                    } else {
                        //Paste folder, no name
                        //Three steps, first obtain the path and name of this folder, then query the folder contains direct files and folders, and finally modify the entry information
                        var neuName = null;
                        async.waterfall([
                            function (callback) {
                                //Locate this entry
                                File.find({ _id: id }).select('path name').exec(function (err, dataDir) {
                                    if (err) callback('MongoDB error ' + err);
                                    else if (!dataDir || dataDir.length < 1) { callback('MongoDB error no matched found ' + id); }
                                    else {
                                        //console.log('locate folder ', dataDir);
                                        callback(null, dataDir[0].path, dataDir[0].name);
                                    }
                                });
                            },
                            function (path, name, callback) {
                                //Finding Files and Folders Under It
                                neuName = name;
                                File.find({ path: path + '/' + name }).select('path fullname isFile').exec(function (err, data) {
                                    if (err) callback('MongoDB error ' + err);
                                    else callback(null, data);
                                });
                            },
                            function (data, callback) {
                                //Modify entry information
                                if (configFile.isCut) {
                                    //Cut the directory only need to modify the database information
                                    var criteria = { _id: id };
                                    var options = { multi: false, upsert: false };
                                    File.update(criteria, {
                                        $set: { path: configFile.dest },
                                        $push: { history: { $each: [{ name: configFile.user, type: 'cut', date: Date.now() }], $position: 0 } }
                                    }, options, function (err, numberAffected, raw) {
                                        if (err) callback('MongoDB error ' + err);
                                        else callback(null, data, id);
                                    });
                                } else {
                                    //Copy the directory, just save a new record according to the original directory, modify the path attribute
                                    File.findById(id, function (err, file) {
                                        if (err) { callback('MongoDB error ' + err); }
                                        else {
                                            //Save database records
                                            var f = new File();
                                            f.name = file.name;
                                            f.fname = file.fname;
                                            f.extension = file.extension;
                                            f.mimetype = file.mimetype;
                                            f.size = file.size;
                                            f.path = configFile.dest;
                                            f.encoding = file.encoding;
                                            f.history = [{ name: configFile.user, type: 'paste' }];
                                            f.isFile = false;
                                            f.save(function (err) {
                                                if (err) callback('MongoDB error ' + err);
                                                else callback(null, data, f._id);
                                            });
                                        }
                                    });
                                }
                            }
                        ], function (err, data, id) {
                            if (err) return res.send(err);
                            res.json({ _id: id, neuDest: configFile.dest + '/' + neuName, data: data, success: true, message: Const.Msg.UpdateOK });
                        });
                    }
                }
            });
        })

        .put(function (req, res) {
            File.findById(req.params.file_id, function (err, file) {
                if (err) return res.send(err);
                if (req.body.name) file.name = req.body.name;
                if (req.body.history) file.history.unshift(req.body.history);
                file.save(function (err) {
                    if (err) return res.send(err);
                    res.json({ success: true, message: Const.Msg.UpdateOK });
                });
            });
        })

        //File deletion
        .delete(function (req, res) {
            var id = req.params.file_id;
            File.findById(id, function (err, file) {
                if (err || !file) {
                    res.send(err);
                } else {
                    if (file.isDelete == 'Thu Jan 01 1970 08:00:00 GMT+0800 (中国标准时间)') {
                        File.update({ _id: id }, { isDelete: Date.now() }, function (err, numAffected) {
                            if (err)
                                return res.send(err);
                            res.json({ success: true, message: Const.Msg.DelOK });
                        });
                    } else {
                        File.remove({ _id: id }, function (err, numAffected) {
                            if (err)
                                return res.send(err);
                            res.json({ success: true, message: Const.Msg.DelOK });
                        });
                    }

                    // fs.unlink(config.uploadDir + file.fname, function(){
                    //     File.remove({
                    //         _id: id
                    //     }, function (err, numAffected) {
                    //         if (err) return res.send(err);
                    //         res.json({success:true, message: Const.Msg.DelOK});
                    //     });
                    // });
                }
            });
        });

    //////////folder////////////////////////////////////////
    /**
     * Delete the directory also need to delete the directory contains files and subdirectories, this process through the path to achieve
     * For example: To delete the ./aaa directory, all paths begin with ./aaa (whether they are files or directories)
     * Both must be deleted, and the deletion condition for converting to Mongoose is:
     * {'$or':[{path:'./ccc/bbbb'},{path:{$regex:'^(./ccc/bbbb/)'}}]}
     */
    apiRouter.route('/folder/')
        .patch(function (req, res) {
            //Delete subdirectories and files first
            var config = req.body;
            var path = config.path;
            //var pathReg = path.replace(/([*+-.?^${}()|[\]\/\\])/g, '\\$1');
            var criteria = { '$or': [{ path: path }, { path: { $regex: '^(' + path + '/)' } }] };
            // File.find(criteria,function(err,data){
            //     console.log(data);
            // });
            if (config.rdelete) {
                File.remove(criteria, function (err, file) {
                    if (err) return res.send(err);
                    //Delete subdirectories and files first
                    File.remove({ _id: config.id }, function (err, file) {
                        if (err) return res.send(err);
                        res.json({ success: true, message: Const.Msg.DelOK });
                    });
                });
            } else {
                //When deleting a directory, the directory is marked as deleted and the subfiles and subdirectories are marked as ten seconds after the initial time
                File.update(criteria, { isDelete: new Date(10000) }, function (err, file) {
                    if (err) return res.send(err);
                    //Then delete the directory itself
                    File.update({ _id: config.id }, { isDelete: Date.now() }, function (err, file) {
                        if (err) return res.send(err);
                        res.json({ success: true, message: Const.Msg.DelOK });
                    });
                });
            }
        })

        //Changes in directory and subfile path caused by directory rename
        //Note that the rename of the directory is not done here, but through the File.update method
        //Serialization is not used here, but the batch modification operation is triggered directly in parallel. This may cause errors.
        .put(function (req, res) {
            //Divided into two steps: 1. Direct subdirectory and folder exact path matching to rename
            var config = req.body;
            var options = { multi: true, upsert: false };
            File.update({ path: config.path + '/' + config.oldName }, { $set: { path: config.path + '/' + config.newName } }, options, function (error) {
                if (error) return res.send(error);
            });
            //2.Renamed by a regular match in the recursive directory
            var oldPath = config.path + '/' + config.oldName + '/';
            var pathReg = oldPath.replace(/([*+-.?^${}()|[\]\/\\])/g, '\\$1');
            console.log(pathReg)
            var criteria = { path: { $regex: '^(' + pathReg + ')' } };
            File.find(criteria).select('_id path').exec(function (err, data) {
                //As the batch cannot be modified, the first step to find these records
                if (err) return res.send(err);
                console.log(data)
                if (data && data.length > 0) {
                    var oldLength = oldPath.length;
                    var stamPath = config.path + '/' + config.newName + '/';
                    for (var i = 0, len = data.length; i < len; i++) {
                        var newPath = stamPath + data[i].path.substring(oldLength);
                        //console.log('update path from ', data[i].path, ' to ', newPath);
                        File.update({ _id: data[i]._id }, { $set: { path: newPath } }, { multi: false, upsert: false }, function (error) {
                            if (error) return res.send(error);
                        });
                    }
                }
                res.json({ success: true });
            });
        });

    ////////////Question Images//////////////////////////////////////////////
    apiRouter.route('/questionimages/')
        //Check if the working directory exists. If it does not exist, add it immediately.
        .patch(function (req, res) {
            var dir = req.body.code;
            Promise.resolve()
                .then(function () {
                    return File.find({ path: '.', name: dir });
                })
                .then(function (data) {
                    if (!data || data.length < 1) {
                        //If it does not exist, create a new one
                        var fo = new File();
                        fo.name = dir;
                        fo.path = '.';
                        fo.isFile = false;
                        fo.extension = 'folder';
                        fo.history = [{ name: req.decoded._id, type: 'create' }];
                        return fo.save();
                    }
                    return Promise.resolve();
                })
                .then(function () {
                    res.json({ success: true });
                })
                .catch(function (error) {
                    res.send(error);
                })
                ;
        })

        //Query all the subdirectories and picture list in the specified directory
        .put(function (req, res) {
            var dir = req.body.dir;
            Promise.resolve()
                .then(function () {
                    /** Construct query conditions
                     * 1.   Must be in the defined directory, the path attribute must be equal to the given directory name
                     * 2.   Or a folder
                     *          Is a file     And the extension is jpg|png|jpeg|bmp|gif|tiff
                     *                      The extension must be followed by the previous controller's question control's questionEditController
                     *                      File selection filter is consistent
                     */
                    var cr = { path: dir };
                    var reg = 'jpg|png|jpeg|bmp|gif|tiff';
                    cr['$or'] = [{ isFile: false }, { isDelete: null }
                        , { isFile: true, extension: { '$regex': reg } }];
                    return File.find(cr).select('path name extension fname isFile');
                })
                .then(function (data) {
                    res.json({ success: true, data: data });
                })
                .catch(function (error) {
                    res.send(JSON.stringify(error));
                })
                ;
        })
        ;

    //////////logs////////////////////////////////////////
    apiRouter.route('/logs')
        //Allows the administrator to empty all data from a table, typically before the data is imported
        .delete(function (req, res) {
            if (!req.decoded) {
                res.json({ message: Const.Msg.Token.Invalid });
            } else {
                //if(!ServerLogger.allowed('log','clear', req.decoded)){
                //        res.json({message:Const.Msg.Token.NotAllowed});
                //}else {
                //    Log.remove({}, function (err) {
                //        if (err) return res.send(err);
                //        ServerLogger.log(req.decoded.id, req.path, 'clear', null);
                //        res.json({success:true, message: Const.Msg.DelOK});
                //    });
                //}

                Log.remove({}, function (err) {
                    if (err) return res.send(err);
                    ServerLogger.log(req.decoded._id, req.path, 'clear', null);
                    res.json({ success: true, message: Const.Msg.DelOK });
                });
            }
        })

        //Used to query the number of records under the specified conditions
        .patch(function (req, res) {
            //if(!ServerLogger.allowed('log','view', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            var criteria = {};
            if (req.body.criteria) {
                criteria = req.body.criteria;
            }

            Log.count(criteria)
                .exec(function (err, count) {
                    if (err) return res.send(err);
                    //console.log('get userCount : ', userCount);
                    res.json({ success: true, count: count });
                });
        })

        //Used to query data collections by page
        .put(function (req, res) {
            //if(!ServerLogger.allowed('log','view', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            //Query data collection, here are pages to query, so need to consider four parameters
            // currentPage，pageSize，criteriaFilter，criteriaSort
            //Default parameter settings
            var criteriaFilter = {};
            if (req.body.criteriaFilter) {
                criteriaFilter = req.body.criteriaFilter;
            }

            var criteriaSort = { code: 1 };
            if (req.body.criteriaSort) {
                criteriaSort = req.body.criteriaSort;
            }

            if (req.body.currentPage && req.body.pageSize) {
                var skip = req.body.currentPage;
                var pageSize = req.body.pageSize;
                //Calculate the number of documents that need to be skipped
                skip = (skip - 1) * pageSize;

                Log.find(criteriaFilter).sort(criteriaSort)
                    .skip(skip).limit(pageSize)
                    .populate('user')
                    .exec(function (err, data) {
                        if (err) return res.send(err);
                        res.json(data);
                    });
            } else {
                //No paging information, return all data records directly
                Log.find(criteriaFilter).sort(criteriaSort)
                    .exec(function (err, data) {
                        if (err) return res.send(err);
                        res.json(data);
                    });
            }
        });

    //////////log_id////////////////////////////////////////
    apiRouter.route('/logs/:log_id')
        .delete(function (req, res) {
            //if(!ServerLogger.allowed('log','delete', req.decoded))
            //    return res.json({message:Const.Msg.NotAuthenticated});

            Log.remove({
                _id: req.params.log_id
            }, function (err, log) {
                if (err) return res.send(err);
                ServerLogger.log(req.decoded._id, req.path, req.method, { _id: req.params.log_id });
                res.json({ success: true, message: Const.Msg.DelOK });
            });
        });

    // Return this routing process as an object for use by other functions
    return apiRouter;
};