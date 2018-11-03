const baseWdioConfig = require('./wdio.base.conf').config;

const wdioConfig = {
    port: 4723,
    capabilities: [
        {
            maxInstances: 1,
            browserName: 'Safari',
            deviceName: 'iPhone 6s',
            deviceOrientation: 'portrait',
            platformVersion: '12.0',
            platformName: 'iOS',
        }
    ],
    services: ['appium']
};

exports.config = {...baseWdioConfig, ...wdioConfig};
