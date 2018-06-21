'use strict';

const EventEmitter = require('events').EventEmitter;
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const checksum = require('./util/crypto');
const pfs = require('./util/pfs');
const mkdirp = require('./util/mkdirp');
const os = require('os');

function pRequest(url) {
    let service = url.startsWith('https') ? https : http;
    return new Promise((resolve, reject) => {
        service.get(url, (res) => {
            resolve(res);
        });
    });
}

// Wirtes a stream to the disk and returns a promise
function download(filePath, res) {
    return new Promise((resolve, reject) => {
        const out = fs.createWriteStream(filePath);
        res.on('end', () => resolve());
        res.on('error', (e) => reject(e));
        res.pipe(out);
    });
}

function toJson(res) {
    return new Promise((resolve, reject) => {
        let body = '',
            json;


        res.on('data', (chunk) => {
            body += chunk;
        });

        res.on('end', () => {
            if (body === '') {
                return resolve();
            }
            try {
                json = JSON.parse(body);
                resolve(json);
            } catch (e) {
                reject(e);
            }
        });

        res.on('error', (e) => reject(e));
    });
}

class AbstractUpdater extends EventEmitter {

    constructor(name) {
        super();
        this.name = name || 'updater';
    }

    get cachePath() {
        let result = path.join(os.tmpdir(), this.name);
        return new Promise((c, e) => mkdirp(result, null, err => err ? e(err) : c(result)));
    }

    setFeedURL(url) {
        this.url = url;
    }

    checkForUpdates() {
        if (!this.url) {
            throw new Error('No feed url set.');
        }

        if (this.currentRequest) {
            return;
        }

        this.emit('checking-for-update');

        this.currentRequest = pRequest(this.url)
            .then(res => toJson(res))
            .then(update => {
                if (!update || !update.url || !update.version) {
                    this.emit('update-not-available');
                    return this.cleanup();
                }

                this.emit('update-available');

                return this.cleanup(update.version).then(() => {
                    return this.getUpdatePackagePath(update.version).then(updatePackagePath => {
                        return pfs.exists(updatePackagePath).then(exists => {
                            let url = update.url,
                                hash = update.hash,
                                downloadPath = `${updatePackagePath}.tmp`;

                            if (exists) {
                                return updatePackagePath;
                            }

                            return pRequest(url)
                                .then(res => download(downloadPath, res))
                                .then(hash ? () => checksum(downloadPath, update.hash) : () => null)
                                .then(() => pfs.rename(downloadPath, updatePackagePath))
                                .then(() => updatePackagePath);
                        });
                    }).then(updatePackagePath => {
                        this.updatePackagePath = updatePackagePath;

                        this.emit('update-downloaded',
                            {},
                            update.releaseNotes,
                            update.version,
                            new Date(),
                            this.url
                        );
                    });
                });
            })
            .catch(e => {
                if ((typeof e === 'string') && /^Server returned/.test(e)) {
                    return;
                }

                this.emit('update-not-available');
                this.emit('error', e);
            })
            .then(() => this.currentRequest = null);
    }

    getUpdatePackageName(version) {
        return `${version}.zip`;
    }

    getUpdatePackagePath(version) {
        return this.cachePath.then(cachePath => path.join(cachePath, this.getUpdatePackageName(version)));
    }

    matchExceptVersion(version, filename) {
        return new RegExp(`${version}\\.zip$`).test(filename);
    }

    cleanup(exceptVersion) {
        let filter = (one) => {
            if (!one) {
                return true;
            }
            return one => !(this.matchExceptVersion(exceptVersion, one));
        };

        // Get the cache path
        return this.cachePath
            // List files in the path
            .then(cachePath => pfs.readdir(cachePath)
                .then(all => {
                    return Promise.all(
                        // Exclude the version we keep
                        all.filter(filter).map(one => {
                            // Delete the file
                            return pfs.unlink(path.join(cachePath, one)).then(null, () => null)
                        })
                    );
                })
            );
    }
}

module.exports = AbstractUpdater;