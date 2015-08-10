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
          sourceMap: true,
          sourceMapIn: "release/mobile-drag-and-drop-polyfill.js.map"
        },
        src: "release/mobile-drag-and-drop-polyfill.js",
        dest: "release/mobile-drag-and-drop-polyfill.min.js"
      }
    },
    connect: {
      dev: {
        options: {
          port: 8000,
          base: ['.', 'spec-compliance'],
          open: true
        }
      },
      release: {
        options: {
          keepalive: true,
          port: 8001,
          base: ['.release/', 'spec-compliance']
        }
      }
    },
    ts: {
      dev: {
        src: ["*.ts", "!node_modules/**/*.ts"],
        watch: '.'
      },
      release: {
        src: ["*.ts", "!node_modules/**/*.ts"],
        outDir: './release',
        options: {
          comments: false,
          declaration: true,
          fast: "never",
          target: "es5"
        }
      }
    },
    copy: {
      release: {
        src: '*.css',
        dest: 'release/'
      }
    }
  });

  grunt.loadNpmTasks("grunt-contrib-uglify");
  grunt.loadNpmTasks("grunt-contrib-connect");
  grunt.loadNpmTasks("grunt-contrib-copy");
  grunt.loadNpmTasks("grunt-ts");

  grunt.registerTask("release", ["ts:release", "copy:release", "uglify:release"]);

  grunt.registerTask("default", ["connect:dev", "ts:dev"]);
};
