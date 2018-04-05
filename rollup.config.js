import sourcemaps from 'rollup-plugin-sourcemaps';

const COMMON_OUTPUT = {
    format: 'umd',
    name: 'MobileDragDrop',
    extend: true,
    sourcemap: true
};

const COMMON = {
    plugins: [
        sourcemaps()
    ]
};

export default [
    {
        ...COMMON,
        input: 'src/index.js',
        output: {
            ...COMMON_OUTPUT,
            file: 'src/index.js',
        }
    },
    {
        ...COMMON,
        input: 'src/scroll-behaviour.js',
        output: {
            ...COMMON_OUTPUT,
            file: 'src/scroll-behaviour.js',
        }
    }
];