const baseWdioConfig = require('./wdio.base.conf').config;

const wdioConfig = {
    port: 4723,
    // If you have trouble getting all important capabilities together, check out the
    // Sauce Labs platform configurator - a great tool to configure your capabilities:
    // https://docs.saucelabs.com/reference/platforms-configurator
    //
    capabilities: [{
        // maxInstances can get overwritten per capability. So if you have an in-house Selenium
        // grid with only 5 firefox instance available you can make sure that not more than
        // 5 instance gets started at a time.
        maxInstances: 1,
        browserName: 'Safari',
        deviceName: 'iPhone 6s',
        deviceOrientation: 'portrait',
        platformVersion: '12.0',
        platformName: 'iOS',
    }],
    // Test runner services
    // Services take over a specific job you don't want to take care of. They enhance
    // your test setup with almost no effort. Unlike plugins, they don't add new
    // commands. Instead, they hook themselves up into the test process.
    services: ['appium']
};

exports.config = {...baseWdioConfig, ...wdioConfig};
