/* jshint node:true */
"use strict";

module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON("package.json"),
    // js minification
    uglify: {
      options: {
        mangle: true, // mangle var names
        mangleProperties: {
          regex: /^_/
        },
        reserveDOMProperties: true, // do not mangle DOM or js props
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
        report: "min"
      },
      main: {
        options: {
          banner: "/*! <%= pkg.name %> <%= pkg.version %> | Copyright (c) <%= grunt.template.today('yyyy') %> Tim Ruffles | BSD 2 License */",
          sourceMapIn: "src/mobile-drag-and-drop-polyfill.js.map"
        },
        src: "src/mobile-drag-and-drop-polyfill.js",
        dest: "src/mobile-drag-and-drop-polyfill.min.js"
      },
      scroll: {
        options: {
          sourceMapIn: "src/mobile-drag-and-drop-polyfill-scroll-behaviour.js.map"
        },
        src: "src/mobile-drag-and-drop-polyfill-scroll-behaviour.js",
        dest: "src/mobile-drag-and-drop-polyfill-scroll-behaviour.min.js"
      }
    },
    // http server config for development and demo page
    connect: {
      // starts a server that will serve the development sources with priority
      // before sources of the demo page. allows to use demo page while developing.
      demo: {
        options: {
          port: 8000,
          open: "http://localhost:8000/spec-compliance/",
          livereload: 35731
        }
      }
    },
    // run tsc from grunt but use tsconfig.json
    ts: {
      build: {
        tsconfig: true
      }
    },
    tslint: {
      options: {
        // can be a configuration object or a filepath to tslint.json
        configuration: "tslint.json"
      },
      files: {
        src: [
          "src/*.ts",
          "!src/*.d.ts"
        ]
      }
    },
    clean: {
      release: ["release"]
    },
    copy: {
      // copy files from src to release folder
      release: {
        files: [
          // includes files within path
          {expand: true, cwd: "src", src: ["*.css", "*.d.ts", "*.js"], dest: "release/", filter: "isFile", flatten: true}
        ]
      }
    },
    // automatically recompile on changes
    watch: {
      ts: {
        files: ["src/**/*.ts", "!src/**/*.d.ts"],
        tasks: ["ts", "uglify"],
        options: {
          debounceDelay: 250,
          atBegin: true,
          livereload: 35731
        }
      },
      resources: {
        files: ["src/**/*.css", "spec-compliance/**/*"],
        options: {
          debounceDelay: 500,
          livereload: 35731
        }
      }
    }
  });

  grunt.loadNpmTasks("grunt-contrib-uglify");
  grunt.loadNpmTasks("grunt-contrib-connect");
  grunt.loadNpmTasks("grunt-contrib-clean");
  grunt.loadNpmTasks("grunt-contrib-copy");
  grunt.loadNpmTasks("grunt-contrib-watch");
  grunt.loadNpmTasks("grunt-ts");
  grunt.loadNpmTasks("grunt-tslint");

  // build files, minify, copy to release folder and demo page (gh pages)
  grunt.registerTask("release", ["ts", "tslint", "uglify", "clean", "copy"]);

  // default task for developers to start coding
  grunt.registerTask("default", ["connect:demo", "watch"]);
};
