const baseWdioConfig = require('./wdio.base.conf');

const wdioConfig = {

    logLevel: 'silent',

    services: ['sauce'],
    user: process.env.SAUCE_USERNAME,
    key: process.env.SAUCE_ACCESS_KEY,

    //TODO configure capabilities for sauce testing
    capabilities:[
        {
            browserName: 'Safari',
            deviceName: 'iPhone 6s Simulator',
            deviceOrientation: 'portrait',
            platformVersion: '12.0',
            platformName: 'iOS',
        }
    ]
};

if (process.env.CI) {
    wdioConfig.capabilities.forEach(function (capability) {

        capability['tunnel-identifier'] = process.env.TRAVIS_JOB_NUMBER;
        capability['build'] = process.env.TRAVIS_BUILD_NUMBER;
    });
}

exports.config = {...baseWdioConfig, ...wdioConfig};
