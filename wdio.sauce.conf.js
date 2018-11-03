const baseWdioConfig = require('./wdio.base.conf');

const wdioConfig = {
    //TODO configure capabilities for sauce testing
    // If you have trouble getting all important capabilities together, check out the
    // Sauce Labs platform configurator - a great tool to configure your capabilities:
    // https://docs.saucelabs.com/reference/platforms-configurator
    capabilities: [
        {
            browserName: 'Safari',
            deviceName: 'iPhone 6s Simulator',
            deviceOrientation: 'portrait',
            platformVersion: '12.0',
            platformName: 'iOS',
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
