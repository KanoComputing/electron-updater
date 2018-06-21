/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const AbstractUpdater = require('./abstract');
const cp = require('child_process');


class Win32AutoUpdater extends AbstractUpdater {

    constructor() {
        super('kano-app-update');
    }

    getUpdatePackageName (version) {
        return `kano-app-${version}.exe`;
    }

    matchExceptVersion (version, filename) {
        return new RegExp(`${version}\\.exe$`).test(filename);
    }

    quitAndInstall() {
        if (!this.updatePackagePath) {
            return;
        }

        cp.spawn(this.updatePackagePath, ['/silent'], {
            detached: true,
            stdio: ['ignore', 'ignore', 'ignore']
        });
    }
}

module.exports = Win32AutoUpdater;