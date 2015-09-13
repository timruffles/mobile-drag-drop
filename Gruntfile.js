/* jshint node:true */
"use strict";

module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON("package.json"),
    uglify: {
      options: {
        banner: "/*! <%= pkg.name %> <%= pkg.version %> | Copyright (c) <%= grunt.template.today('yyyy') %> Tim Ruffles | BSD 2 License */"
      },
      release: {
        options: {
          mangle: true, // mangle var names
          mangleProperties: true, // mangle props
          reserveDOMProperties: true, // do not mangle DOM or js props
          mangleRegex: /^_/,  // mangle all props starting with an `_`
          compress: {
            global_defs: {
              "DEBUG": false
            },
            drop_console: true, // remove console log statements
            drop_debugger: true, // remove debugger statements
            dead_code: true, // removes unreachable code
            unused: true, // remove unused code
            sequences: true,
            if_return: true,
            join_vars: true,
            keep_fargs: true,
            conditionals: true,
            evaluate: true
          },
          sourceMap: true,
          sourceMapIn: "mobile-drag-and-drop-polyfill.js.map",
          report: "min"
        },
        src: "mobile-drag-and-drop-polyfill.js",
        dest: "release/mobile-drag-and-drop-polyfill.min.js"
      }
    },
    connect: {
      dev: {
        options: {
          port: 8000,
          // target development files
          base: ['.', 'spec-compliance'],
          open: true,
          //livereload: true
        }
      },
      release: {
        options: {
          keepalive: true,
          port: 8001,
          base: ['spec-compliance']
        }
      }
    },
    ts: {
      dev: {
        src: ["*.ts", "!node_modules/**/*.ts"],
        watch: ".",
        options: {
          target: "es5"
        }
      },
      release: {
        src: ["*.ts", "!node_modules/**/*.ts"],
        outDir: './release/',
        options: {
          noImplicitAny: true,
          suppressImplicitAnyIndexErrors: true,
          removeComments: true,
          declaration: true,
          fast: "never",
          target: "es5"
        }
      },
      es6: {
        src: ["*.ts", "!node_modules/**/*.ts"],
        out: "mobile-drag-and-drop-polyfill.es6.js",
        options: {
          declaration: false,
          fast: "never",
          target: "es6"
        }
      }
    },
    copy: {
      release: {
        files: [
          // includes files within path
          {expand: false, src: ['*.css'], dest: 'release/', filter: 'isFile'}
        ]
      },
      demoPage: {
        files: [
          // includes files within path
          {expand: true, cwd: 'release', src: ['*.map', '*.js', '*.css'], dest: 'spec-compliance/', filter: 'isFile', flatten: true}
        ]
      }
    }
  });

  grunt.loadNpmTasks("grunt-contrib-uglify");
  grunt.loadNpmTasks("grunt-contrib-connect");
  grunt.loadNpmTasks("grunt-contrib-copy");
  grunt.loadNpmTasks("grunt-ts");

  grunt.registerTask("release", ["ts:release", "uglify:release", "copy:release", "copy:demoPage"]);

  grunt.registerTask("default", ["connect:dev", "ts:dev"]);
};
