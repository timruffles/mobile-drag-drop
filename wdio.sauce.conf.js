const baseWdioConfig = require('./wdio.base.conf').config;

const wdioConfig = {
    //TODO configure capabilities for sauce testing
    // If you have trouble getting all important capabilities together, check out the
    // Sauce Labs platform configurator - a great tool to configure your capabilities:
    // https://wiki.saucelabs.com/display/DOCS/Platform+Configurator
    capabilities: [
        // iOS
        {
            browserName: 'Safari',
            deviceName: 'iPhone 7 Simulator',
            deviceOrientation: 'portrait',
            platformVersion: '10.0',
            platformName: 'iOS',
        },
        {
            browserName: 'Safari',
            deviceName: 'iPhone 7 Simulator',
            deviceOrientation: 'portrait',
            platformVersion: '10.2',
            platformName: 'iOS',
        },
        {
            browserName: 'Safari',
            deviceName: 'iPhone 7 Simulator',
            deviceOrientation: 'portrait',
            platformVersion: '10.3',
            platformName: 'iOS',
        },
        {
            browserName: 'Safari',
            deviceName: 'iPhone 8 Simulator',
            deviceOrientation: 'portrait',
            platformVersion: '11.0',
            platformName: 'iOS',
        },
        {
            browserName: 'Safari',
            deviceName: 'iPhone 8 Simulator',
            deviceOrientation: 'portrait',
            platformVersion: '11.1',
            platformName: 'iOS',
        },
        {
            browserName: 'Safari',
            deviceName: 'iPhone 8 Simulator',
            deviceOrientation: 'portrait',
            platformVersion: '11.2',
            platformName: 'iOS',
        },
        {
            browserName: 'Safari',
            deviceName: 'iPhone 8 Simulator',
            deviceOrientation: 'portrait',
            platformVersion: '11.3',
            platformName: 'iOS',
        },
        {
            browserName: 'Safari',
            deviceName: 'iPhone XS Simulator',
            deviceOrientation: 'portrait',
            platformVersion: '12.0',
            platformName: 'iOS',
        },
        // Android Chrome
        {
            browserName: 'Chrome',
            deviceName: 'Android GoogleAPI Emulator',
            deviceOrientation: 'portrait',
            platformVersion: '4.4',
            platformName: 'Android',
        },
        {
            browserName: 'Chrome',
            deviceName: 'Android GoogleAPI Emulator',
            deviceOrientation: 'portrait',
            platformVersion: '4.4',
            platformName: 'Android',
        },
        {
            browserName: 'Chrome',
            deviceName: 'Android GoogleAPI Emulator',
            deviceOrientation: 'portrait',
            platformVersion: '5.0',
            platformName: 'Android',
        },
        {
            browserName: 'Chrome',
            deviceName: 'Android GoogleAPI Emulator',
            deviceOrientation: 'portrait',
            platformVersion: '5.1',
            platformName: 'Android',
        },
        {
            browserName: 'Chrome',
            deviceName: 'Android GoogleAPI Emulator',
            deviceOrientation: 'portrait',
            platformVersion: '6.0',
            platformName: 'Android',
        },
        {
            browserName: 'Chrome',
            deviceName: 'Google Pixel GoogleAPI Emulator',
            deviceOrientation: 'portrait',
            platformVersion: '7.0',
            platformName: 'Android',
        },
        {
            browserName: 'Chrome',
            deviceName: 'Google Pixel GoogleAPI Emulator',
            deviceOrientation: 'portrait',
            platformVersion: '7.1',
            platformName: 'Android',
        }
    ],
    services: ['sauce'],
    user: process.env.SAUCE_USERNAME,
    key: process.env.SAUCE_ACCESS_KEY
};

if (process.env.CI) {
    wdioConfig.capabilities.forEach(function (capability) {

        capability['tunnel-identifier'] = process.env.TRAVIS_JOB_NUMBER;
        capability['build'] = process.env.TRAVIS_BUILD_NUMBER;
    });
}
else {
    wdioConfig.sauceConnect = true;
}

exports.config = {...baseWdioConfig, ...wdioConfig};
