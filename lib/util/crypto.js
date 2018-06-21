/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
const fs = require('fs');
const crypto = require('crypto');

module.exports = function checksum(path, sha1hash) {
    const promise = new Promise((c, e) => {
        const input = fs.createReadStream(path);
        const hashStream = crypto.createHash('sha1');
        input.pipe(hashStream);

        const done = (err, result) => {
            input.removeAllListeners();
            hashStream.removeAllListeners();

            if (err) {
                e(err);
            } else {
                c(result);
            }
        };

        input.once('error', done);
        input.once('end', () => done());
        hashStream.once('error', done);
        hashStream.once('data', data => done(null, data.toString('hex')));
    });

    return promise.then(hash => {
        if (hash !== sha1hash) {
            throw new Error('Hash mismatch');
        }
    });
};