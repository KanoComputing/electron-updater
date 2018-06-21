const mockSpawn = require('mock-spawn');
const should = require('should');
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const eventsUtil = require('./util/events');
const PORT = 1111;
const NEW_VERSION = '1.0.1';
const UPDATE_FILE_CONTENTS = `#!/bin/bash\necho 'success' > update-executed`;

let originalSpawn = cp.spawn,
    serverDown, serverNoUpdate, serverUpdate;

// Mock server failing
serverDown = () => {
    return http.createServer((req, res) => {
        res.statusCode = 500;
        res.end();
    }).listen(PORT);
}

// Mock server with no update
serverNoUpdate = () => {
    return http.createServer((req, res) => {
        res.statusCode = 204;
        res.end();
    }).listen(PORT);
}

// Mock server containing an update
serverUpdate = () => {
    return http.createServer((req, res) => {
        res.statusCode = 200;
        // The client asks for the update file, send it
        if (req.url === '/get-file') {
            res.setHeader('Content-Type', 'application/octet-stream');
            res.end(UPDATE_FILE_CONTENTS);
        } else {
            // The user wants the current update, say it is up to date
            if (req.url === `/check-for-updates?v=${NEW_VERSION}&platform=win32`) {
                res.statusCode = 204;
                res.end();
            } else {
                // Send the new version data
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                    url: `http://localhost:${PORT}/get-file`,
                    version: NEW_VERSION
                }));
            }
        }
    }).listen(PORT);
}

/**
 * Replaces `spawn` with a fake one
 * @param {*} strategy
 */
function applyFakeSpawn(strategy) {
    let customSpawn = mockSpawn();
    customSpawn.setStrategy(strategy);
    cp.spawn = customSpawn;
}

/**
 * Restores the original spawn
 */
function restoreSpawn() {
    cp.spawn = originalSpawn;
}

describe('Win32 Auto Updater', () => {
    let Win32AutoUpdater = require('../lib/win32.js'),
        server;
    describe('server is down', () => {
        let autoUpdater;
        before((done) => {
            autoUpdater = new Win32AutoUpdater();
            server = serverDown();
            done();
        });
        after((done) => {
            server.close();
            done();
        });
        it('should trigger `update-not-available`', (done) => {
            autoUpdater.setFeedURL(`http://localhost:1111/check-for-updates?v=0.0.1&platform=win32`);
            eventsUtil.waitForEvent(autoUpdater, 'checking-for-update')
                .then(() => eventsUtil.waitForEvent(autoUpdater, 'update-not-available'))
                .then(() => {
                    done();
                }).catch(e => null);
            autoUpdater.checkForUpdates();
            autoUpdater.on('error', done);
        });
    });

    describe('server has no update', () => {
        let autoUpdater;
        before((done) => {
            autoUpdater = new Win32AutoUpdater();
            server = serverNoUpdate();
            done();
        });
        after((done) => {
            server.close();
            done();
        });
        it('should trigger `update-not-available`', (done) => {
            autoUpdater.setFeedURL(`http://localhost:1111/check-for-updates?v=0.0.1&platform=win32`);
            eventsUtil.waitForEvent(autoUpdater, 'checking-for-update')
                .then(() => eventsUtil.waitForEvent(autoUpdater, 'update-not-available'))
                .then(() => {
                    done();
                }).catch(e => null);
            autoUpdater.checkForUpdates();
            autoUpdater.on('error', done);
        });
    });

    describe('server has updates', () => {
        let autoUpdater;
        // Setup updater, fake server and fake fs
        before((done) => {
            server = serverUpdate();
            done();
        });

        beforeEach(() => {
            autoUpdater = new Win32AutoUpdater();
        });

        // Tear down test
        after((done) => {
            server.close();
            done();
        });

        it('with same version should trigger `update-not-available`', (done) => {
            autoUpdater.setFeedURL(`http://localhost:1111/check-for-updates?v=${NEW_VERSION}&platform=win32`);
            eventsUtil.waitForEvent(autoUpdater, 'checking-for-update')
                .then(() => eventsUtil.waitForEvent(autoUpdater, 'update-not-available'))
                .then(() => done())
                .catch(e => done(e));
            autoUpdater.checkForUpdates();
            autoUpdater.on('error', done);
        });

        it('with older version should trigger `update-available` and execute the update', (done) => {
            let updateLocation = path.join(os.tmpdir(), 'kano-app-update'),
                updateFile = path.join(updateLocation, `kano-app-${NEW_VERSION}.exe`),
                updateExecuted = path.join(updateLocation, 'update-executed');

            autoUpdater.setFeedURL(`http://localhost:1111/check-for-updates?v=0.0.1&platform=win32`);
            eventsUtil.waitForEvent(autoUpdater, 'checking-for-update')
                .then(() => eventsUtil.waitForEvent(autoUpdater, 'update-available'))
                .then(() => eventsUtil.waitForEvent(autoUpdater, 'update-downloaded'))
                .then((d, releaseNotes, version, date, url, applyUpdate) => {
                    return new Promise((resolve, reject) => {
                        fs.readFile(updateFile, (err, contents) => {
                            if (err) {
                                return reject(new Error('Expected update file to be created'));
                            }
                            resolve(contents.toString());
                        });
                    });
                })
                .then(contents => {
                    contents.should.be.eql(UPDATE_FILE_CONTENTS);
                })
                .then(() => {
                    return new Promise((resolve, reject) => {
                        applyFakeSpawn((cmd, args) => {
                            cmd.should.be.eql(updateFile);
                            args.should.have.length(1);
                            args[0].should.be.eql('/silent');
                            resolve();
                        });
                        autoUpdater.quitAndInstall();
                        restoreSpawn();
                    });
                })
                .then(() => {
                    done();
                })
                .catch(done);
            autoUpdater.checkForUpdates();
            autoUpdater.on('error', done);
        });
    });
});