const fs = require('fs');
const path = require('path');

function isDirectory(location, callback) {
    fs.lstat(location, (err, stats) => {
        if (err) {
            return callback(err);
        }
        callback(null, stats.isDirectory());
    })
}

module.exports = function mkdirp(location, mode, callback) {
    fs.exists(location, (exists) => {
        if (exists) {
            return isDirectory(location, (err, itIs) => {
                if (err) {
                    return callback(err);
                }

                if (!itIs) {
                    return callback(new Error('"' + location + '" is not a directory.'));
                }

                callback(null);
            });
        }

        mkdirp(path.dirname(location), mode, (err) => {
            if (err) {
                callback(err);
                return;
            }

            if (mode) {
                fs.mkdir(location, mode, (error) => {
                    if (error) {
                        return callback(error);
                    }

                    fs.chmod(location, mode, callback); // we need to explicitly chmod because of https://github.com/nodejs/node/issues/1104
                });
            } else {
                fs.mkdir(location, null, callback);
            }
        });
    });
};