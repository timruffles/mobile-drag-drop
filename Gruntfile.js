/* jshint node:true */
"use strict";

module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON("package.json"),
    groundskeeper: {
      release_min: {
        files: {
          "mobile-drag-and-drop-polyfill.min.tmp.js": "mobile-drag-and-drop-polyfill.tmp.js"
        },
        options: {
          console: true, // keep console statements
          debugger: false,
          pragmas: ["editor-fold"]
        }
      }
    },
    uglify: {
      options: {
        banner: "/*! <%= pkg.name %> <%= pkg.version %> | Copyright (c) <%= grunt.template.today('yyyy') %> Tim Ruffles | BSD 2 License */"
      },
      release_min: {
        options: {
          compress: {
            drop_console: true, // remove console log statements
            dead_code: true, // removes unreachable code,
            drop_debugger: true, // remove debugger statements
            unused: true, // remove unused code
            sequences: true,
            join_vars: true,
            keep_fargs: true
          },
          sourceMap: true,
          sourceMapIn: "mobile-drag-and-drop-polyfill.tmp.js.map",
          report: "min"
        },
        src: "mobile-drag-and-drop-polyfill.min.tmp.js",
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
          declaration: true,
          fast: "never",
          target: "es5"
        }
      },
      release_min: {
        src: ["*.ts", "!node_modules/**/*.ts"],
        out: "mobile-drag-and-drop-polyfill.tmp.js",
        options: {
          removeComments: false,
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
    },
    clean: {
      release_min: {
        files: [
          {expand: false, src: ['*.tmp.js*'], filter: 'isFile'}
        ]
      }
    }
  });

  grunt.loadNpmTasks("grunt-contrib-uglify");
  grunt.loadNpmTasks("grunt-contrib-connect");
  grunt.loadNpmTasks("grunt-contrib-copy");
  grunt.loadNpmTasks("grunt-contrib-clean");
  grunt.loadNpmTasks("grunt-ts");
  grunt.loadNpmTasks('grunt-groundskeeper');

  grunt.registerTask("release", ["ts:release_min", "groundskeeper:release_min", "uglify:release_min", "clean:release_min", "ts:release", "copy:release", "copy:demoPage"]);

  grunt.registerTask("default", ["connect:dev", "ts:dev"]);
};
