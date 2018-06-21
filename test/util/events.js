/**
 * Returns a promise. Resolves if and when the event expected arrived.
 * Rejects when the event wasn't received after a timeout
 * @param {*} emitter
 * @param {*} eventName
 * @param {*} timeout
 */
function waitForEvent(emitter, eventName, timeout) {
    return new Promise((resolve, reject) => {
        let onEvent, id;
        timeout = timeout || 2000;

        onEvent = function(data) {
            clearTimeout(id);
            emitter.removeListener(eventName, onEvent);
            resolve.apply(null, arguments);
        };

        emitter.on(eventName, onEvent);
        id = setTimeout(() => {
            reject(new Error(`Event '${eventName}' not received after ${timeout}ms`));
        }, timeout);
    });
}

function ensureNoEvent(emitter, eventName, timeout) {
    return new Promise((resolve, reject) => {
        let onEvent, id;
        timeout = timeout || 2000;

        onEvent = function(data) {
            clearTimeout(id);
            emitter.removeListener(eventName, onEvent);
            reject(new Error(`Unexpected event '${eventName}' received`));
        };

        emitter.on(eventName, onEvent);
        id = setTimeout(() => {
            resolve();
        }, timeout);
    });
}

module.exports = { waitForEvent, ensureNoEvent };