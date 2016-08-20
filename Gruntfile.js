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
          regex: /^_/ // this will mangle all properties starting with an underscore
        },
        reserveDOMProperties: true, // do not mangle browser props
        compress: {
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
          sourceMapIn: "src/drag-drop-polyfill.js.map"
        },
        src: "src/drag-drop-polyfill.js",
        dest: "src/drag-drop-polyfill.min.js"
      },
      scroll: {
        options: {
          sourceMapIn: "src/drag-drop-polyfill-scroll-behaviour.js.map"
        },
        src: "src/drag-drop-polyfill-scroll-behaviour.js",
        dest: "src/drag-drop-polyfill-scroll-behaviour.min.js"
      }
    },
    // http server config for development and demo page
    connect: {
      // starts a server that will serve the development sources
      // instead of the release sources.
      dev: {
        options: {
          port: 8000,
          open: "http://localhost:8000/spec-compliance/",
          livereload: 35731,
          middleware: function (connect, options, middlewares) {

            // inject a custom middleware into the array of default middlewares
            middlewares.unshift(function (req, res, next) {

              // regex matching release file urls
              var redirectFrom = /\/release\//;
              // src url fragment
              var redirectTo = "/src/";

              if (redirectFrom.test(req.url)) {

                // modify url to point to src files
                var srcUrl = req.url.replace(redirectFrom, redirectTo);
                // unminified sources
                req.url = srcUrl.replace(".min", "");
              }

              next();
            });

            return middlewares;
          }
        }
      },
      // starts a server that will serve the demo page with release sources
      release: {
        options: {
          port: 8001,
          open: "http://localhost:8001/spec-compliance/"
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
        tasks: ["ts"],
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
    },
    // bump version, commit, tag
    bump: {
      options: {
        files: ["package.json", "bower.json"],
        updateConfigs: ["pkg"],
        commit: true,
        commitMessage: "Release v%VERSION%",
        commitFiles: ["package.json", "bower.json", "CHANGELOG.md", "release"],
        createTag: true,
        tagName: "v%VERSION%",
        tagMessage: "Version %VERSION%",
        push: true,
        pushTo: "origin",
        gitDescribeOptions: "--tags --always --abbrev=1 --dirty=-d",
        globalReplace: false,
        prereleaseName: "beta",
        metadata: "",
        regExp: false
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
  grunt.loadNpmTasks('grunt-npm');
  grunt.loadNpmTasks('grunt-bump');

  // compile, lint, minify, clean copy to release folder
  grunt.registerTask("prepare-release", "Prepare a release by building release files and bumping version", function (bump) {
    if (!bump) {
      grunt.log.error("You must specify the version bump! See https://github.com/vojtajina/grunt-bump/tree/v0.7.0");
      return;
    }
    grunt.task.run("ts", "tslint", "bump-only:" + bump, "uglify", "clean", "copy");
  });

  // serve release files
  grunt.registerTask("serve-release", "serve release files for checking that release files have no issues", ["connect:release", "watch:resources"]);

  // publish a prepared release
  grunt.registerTask("publish-release", ["bump-commit", "npm-publish"]);

  // default task for developers to start coding
  grunt.registerTask("default", ["connect:dev", "watch"]);
};
