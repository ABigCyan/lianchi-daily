var capacitorLocalNotifications = (function (exports, core) {
    'use strict';

    /// <reference types="@capacitor/cli" />
    /**
     * Day of the week. Used for scheduling notifications on a particular weekday.
     */
    exports.Weekday = void 0;
    (function (Weekday) {
        Weekday[Weekday["Sunday"] = 1] = "Sunday";
        Weekday[Weekday["Monday"] = 2] = "Monday";
        Weekday[Weekday["Tuesday"] = 3] = "Tuesday";
        Weekday[Weekday["Wednesday"] = 4] = "Wednesday";
        Weekday[Weekday["Thursday"] = 5] = "Thursday";
        Weekday[Weekday["Friday"] = 6] = "Friday";
        Weekday[Weekday["Saturday"] = 7] = "Saturday";
    })(exports.Weekday || (exports.Weekday = {}));

    const LocalNotifications = core.registerPlugin('LocalNotifications', {
        web: () => Promise.resolve().then(function () { return web; }).then((m) => new m.LocalNotificationsWeb()),
    });

    class LocalNotificationsWeb extends core.WebPlugin {
        constructor() {
            super(...arguments);
            this.pending = [];
            this.deliveredNotifications = [];
            this.hasNotificationSupport = () => {
                if (!('Notification' in window) || !Notification.requestPermission) {
                    return false;
                }
                if (Notification.permission !== 'granted') {
                    // don't test for `new Notification` if permission has already been granted
                    // otherwise this sends a real notification on supported browsers
                    try {
                        new Notification('');
                    }
                    catch (e) {
                        if (e instanceof Error && e.name === 'TypeError') {
                            return false;
                        }
                    }
                }
                return true;
            };
        }
        async getDeliveredNotifications() {
            const deliveredSchemas = [];
            for (const notification of this.deliveredNotifications) {
                const deliveredSchema = {
                    title: notification.title,
                    id: parseInt(notification.tag),
                    body: notification.body,
                };
                deliveredSchemas.push(deliveredSchema);
            }
            return {
                notifications: deliveredSchemas,
            };
        }
        async removeDeliveredNotifications(delivered) {
            for (const toRemove of delivered.notifications) {
                const found = this.deliveredNotifications.find((n) => n.tag === String(toRemove.id));
                found === null || found === void 0 ? void 0 : found.close();
                this.deliveredNotifications = this.deliveredNotifications.filter(() => !found);
            }
        }
        async removeDeliveredNotificationsById(options) {
            for (const id of options.ids) {
                const found = this.deliveredNotifications.find((n) => n.tag === String(id));
                found === null || found === void 0 ? void 0 : found.close();
                this.deliveredNotifications = this.deliveredNotifications.filter((n) => n !== found);
            }
        }
        async removeAllDeliveredNotifications() {
            for (const notification of this.deliveredNotifications) {
                notification.close();
            }
            this.deliveredNotifications = [];
        }
        async getByIds(options) {
            const ids = options.ids.map((id) => String(id));
            const scheduled = this.pending.filter((n) => ids.includes(String(n.id)));
            const delivered = this.deliveredNotifications
                .filter((n) => ids.includes(n.tag))
                .map((n) => this.deliveredToSchema(n));
            return { notifications: [...scheduled, ...delivered] };
        }
        async getAll(options) {
            const scheduled = [...this.pending];
            const delivered = this.deliveredNotifications.map((n) => this.deliveredToSchema(n));
            if ((options === null || options === void 0 ? void 0 : options.state) === 'SCHEDULED') {
                return { notifications: scheduled };
            }
            if ((options === null || options === void 0 ? void 0 : options.state) === 'TRIGGERED') {
                return { notifications: delivered };
            }
            return { notifications: [...scheduled, ...delivered] };
        }
        deliveredToSchema(notification) {
            return {
                title: notification.title,
                id: parseInt(notification.tag),
                body: notification.body,
            };
        }
        async createChannel() {
            throw this.unimplemented('Not implemented on web.');
        }
        async deleteChannel() {
            throw this.unimplemented('Not implemented on web.');
        }
        async listChannels() {
            throw this.unimplemented('Not implemented on web.');
        }
        async schedule(options) {
            if (!this.hasNotificationSupport()) {
                throw this.unavailable('Notifications not supported in this browser.');
            }
            for (const notification of options.notifications) {
                this.sendNotification(notification);
            }
            return {
                notifications: options.notifications.map((notification) => ({
                    id: notification.id,
                })),
            };
        }
        async update(options) {
            if (!this.hasNotificationSupport()) {
                throw this.unavailable('Notifications not supported in this browser.');
            }
            const updated = [];
            for (const notification of options.notifications) {
                const index = this.pending.findIndex((n) => n.id === notification.id);
                if (index === -1) {
                    // Only update notifications that are already scheduled.
                    continue;
                }
                this.pending.splice(index, 1);
                this.sendNotification(notification);
                updated.push(notification);
            }
            return {
                notifications: updated.map((notification) => ({ id: notification.id })),
            };
        }
        async getPending() {
            return {
                notifications: this.pending,
            };
        }
        async cancelAll() {
            this.pending = [];
        }
        async registerActionTypes() {
            throw this.unimplemented('Not implemented on web.');
        }
        async cancel(pending) {
            this.pending = this.pending.filter((notification) => !pending.notifications.find((n) => n.id === notification.id));
        }
        async areEnabled() {
            const { display } = await this.checkPermissions();
            return {
                value: display === 'granted',
            };
        }
        async changeExactNotificationSetting() {
            throw this.unimplemented('Not implemented on web.');
        }
        async checkExactNotificationSetting() {
            throw this.unimplemented('Not implemented on web.');
        }
        async requestPermissions() {
            if (!this.hasNotificationSupport()) {
                throw this.unavailable('Notifications not supported in this browser.');
            }
            const display = this.transformNotificationPermission(await Notification.requestPermission());
            return { display };
        }
        async checkPermissions() {
            if (!this.hasNotificationSupport()) {
                throw this.unavailable('Notifications not supported in this browser.');
            }
            const display = this.transformNotificationPermission(Notification.permission);
            return { display };
        }
        transformNotificationPermission(permission) {
            switch (permission) {
                case 'granted':
                    return 'granted';
                case 'denied':
                    return 'denied';
                default:
                    return 'prompt';
            }
        }
        sendPending() {
            var _a;
            const toRemove = [];
            const now = new Date().getTime();
            for (const notification of this.pending) {
                if (((_a = notification.schedule) === null || _a === void 0 ? void 0 : _a.at) && notification.schedule.at.getTime() <= now) {
                    this.buildNotification(notification);
                    toRemove.push(notification);
                }
            }
            this.pending = this.pending.filter((notification) => !toRemove.find((n) => n === notification));
        }
        sendNotification(notification) {
            var _a;
            if ((_a = notification.schedule) === null || _a === void 0 ? void 0 : _a.at) {
                const diff = notification.schedule.at.getTime() - new Date().getTime();
                this.pending.push(notification);
                setTimeout(() => {
                    this.sendPending();
                }, diff);
                return;
            }
            this.buildNotification(notification);
        }
        buildNotification(notification) {
            const localNotification = new Notification(notification.title, {
                body: notification.body,
                tag: String(notification.id),
            });
            localNotification.addEventListener('click', this.onClick.bind(this, notification), false);
            localNotification.addEventListener('show', this.onShow.bind(this, notification), false);
            localNotification.addEventListener('close', () => {
                this.deliveredNotifications = this.deliveredNotifications.filter(() => !this);
            }, false);
            this.deliveredNotifications.push(localNotification);
            return localNotification;
        }
        onClick(notification) {
            const data = {
                actionId: 'tap',
                notification,
            };
            this.notifyListeners('localNotificationActionPerformed', data);
        }
        onShow(notification) {
            this.notifyListeners('localNotificationReceived', notification);
        }
    }

    var web = /*#__PURE__*/Object.freeze({
        __proto__: null,
        LocalNotificationsWeb: LocalNotificationsWeb
    });

    exports.LocalNotifications = LocalNotifications;

    return exports;

})({}, capacitorExports);
//# sourceMappingURL=plugin.js.map
