import cleanup from 'rollup-plugin-cleanup';
import sourcemaps from 'rollup-plugin-sourcemaps';

const pkg = require('./package.json');

export default {
    format: 'umd',
    banner: `/*! ${pkg.name} ${pkg.version} | Copyright (c) ${(new Date()).getFullYear()} Tim Ruffles | BSD 2 License */`,
    sourceMap: true,
    plugins: [
        cleanup(),
        sourcemaps()
    ]
};
