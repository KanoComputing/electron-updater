const fs = require('fs');

module.exports = {
    exists: function exists(filepath) {
        return new Promise((resolve, reject) => {
            fs.stat(filepath, (err) => {
                if (err) {
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    },
    readdir: function readdir(filepath) {
        return new Promise((resolve, reject) => {
            fs.readdir(filepath, (err, dirs) => {
                if (err) {
                    reject();
                } else {
                    resolve(dirs);
                }
            });
        })
    },
    unlink: function unlink(filepath) {
        return new Promise((resolve, reject) => {
            fs.unlink(filepath, (err) => {
                if (err) {
                    reject();
                } else {
                    resolve();
                }
            });
        });
    },
    rename: function rename(oldName, newName) {
        return new Promise((resolve, reject) => {
            fs.rename(oldName, newName, (err) => {
                if (err) {
                    reject();
                } else {
                    resolve();
                }
            });
        });
    }
};