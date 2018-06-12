/**
 * 
List of constants used in the project
 */

module.exports = {
    //Information
    Msg : {
        Welcome: 'Guten Tag! Willkommen zu Yuyi\'s API fuer MEAN-Stack!',

        //General Information
        NoCode      : 'Code not specified',
        NoName      : 'Name not specified',
        CodeNotExist  : 'Code does not exist',
        Duplicate   :   'Code already exists, new operation failed',
        AddOK       : 'Created successfully',
        DelOK       : 'successfully deleted',
        UpdateOK    : 'Update information is successful',
        CodeNotGiven: 'The code is not given',
        NameNotGiven: 'Name is not given',
        DelRelatedObj :'There are other data associations that cannot be deleted',
        NotAuthenticated: 'Current user does not have permission',
        NotSupported: 'Unsupported operation',
        User :{
            NoPWD       : 'User password is not specified',
            PwdMinLength : 'User password is at least 4 digits',
            PwdWrong    : 'wrong password',
            PwdNotEqual : 'Two passwords are inconsistent',
            CodeMinLength : 'User code at least 2',
            NameMinLength : 'At least 2 user names',
            LoginOK     : 'Enjoy your token',
            PwdNotGiven : 'The password is not given',
            RoleNotGiven : 'User role is not given'
        },
        Token :{
            Invalid     : 'User login token validation failed.',
            None        : 'User verification tag is not provided.',
            NotAllowed  : 'Users cannot do this'
        }
    }
};