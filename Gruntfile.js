/* jshint node:true */
"use strict";

var umdName = "MobileDragDrop";

module.exports = function (grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json"),
        // various cli execution configs
        exec: {
            rollup: {
                cmd: "rollup -c"
            },
            ts: {
                cmd: "tsc -p tsconfig.json"
            },
            tslint: {
                cmd: "tslint -p tsconfig.json"
            }
        },
        // append UMD declaration to d.ts files
        append: {
            umdDeclaration: {
                append: "export as namespace " + umdName + ";",
                files: {
                    "src/index.d.ts": "src/index.d.ts",
                    "src/scroll-behaviour.d.ts": "src/scroll-behaviour.d.ts"
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
                commitFiles: ["package.json", "package-lock.json", "bower.json", "CHANGELOG.md", "release"],
                createTag: true,
                tagName: "v%VERSION%",
                tagMessage: "Version %VERSION%",
                push: true,
                pushTo: "origin",
                gitDescribeOptions: "--tags --always --abbrev=1 --dirty=-d",
                globalReplace: false,
                prereleaseName: "rc",
                metadata: "",
                regExp: false
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
                    {
                        expand: true,
                        cwd: "src",
                        src: ["*.css", "**/*.d.ts", "*.js", "*.map"],
                        dest: "release/",
                        filter: "isFile",
                        flatten: false
                    },
                    {
                        src: "package.json",
                        dest: "release/"
                    }
                ]
            }
        },
        // http server config for development and demo page
        connect: {
            // starts a server that will serve the development sources
            // instead of the release sources.
            dev: {
                options: {
                    port: 8000,
                    open: "http://localhost:8000/demo/",
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
                    open: "http://localhost:8001/demo/"
                }
            }
        },
        // js minification
        uglify: {
            options: {
                // mangle var names
                mangle: {
                    reserved: [
                        umdName
                    ],
                    properties: {
                        regex: /^_/ // this will mangle all properties starting with an underscore
                    }
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
                    evaluate: true,
                    passes: 1,
                    warnings: true
                },
                sourceMap: true,
                report: "gzip"
            },
            main: {
                options: {
                    banner: "/*! <%= pkg.name %> <%= pkg.version %> | Copyright (c) <%= grunt.template.today('yyyy') %> Tim Ruffles | MIT License */",
                    sourceMapIn: "src/index.js.map"
                },
                src: "src/index.js",
                dest: "src/index.min.js"
            },
            scroll: {
                options: {
                    sourceMapIn: "src/scroll-behaviour.js.map"
                },
                src: "src/scroll-behaviour.js",
                dest: "src/scroll-behaviour.min.js"
            }
        },
        // automatically recompile on changes, demo page livereload
        watch: {
            ts: {
                files: ["src/**/*.ts", "!src/**/*.d.ts"],
                tasks: ["compile"],
                options: {
                    debounceDelay: 250,
                    atBegin: true,
                    livereload: 35731
                }
            },
            resources: {
                files: ["src/**/*.css", "demo/**/*"],
                options: {
                    debounceDelay: 500,
                    livereload: 35731
                }
            }
        },
    });

    grunt.loadNpmTasks("grunt-contrib-uglify");
    grunt.loadNpmTasks("grunt-contrib-connect");
    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks("grunt-contrib-copy");
    grunt.loadNpmTasks("grunt-contrib-watch");
    grunt.loadNpmTasks("grunt-npm");
    grunt.loadNpmTasks("grunt-bump");
    grunt.loadNpmTasks("grunt-exec");

    grunt.registerMultiTask("append", function () {

        var appendTxt = this.data.append || "";

        this.files.forEach(function (file) {
            file.src
                .filter(function (filepath) {
                    // Remove nonexistent files (it's up to you to filter or warn here).
                    if (!grunt.file.exists(filepath)) {
                        grunt.log.warn('Source file "' + filepath + '" not found.');
                        return false;
                    } else {
                        return true;
                    }
                })
                .map(function (filepath) {
                    // Read and return the file's source.
                    return grunt.file.read(filepath) + appendTxt;
                })
                .forEach(function (content) {

                    // Write joined contents to destination filepath.
                    grunt.file.write(file.dest, content);
                    // Print a success message.
                    grunt.log.writeln('Appended "' + appendTxt + '" saved to "' + file.dest + '".');
                });
        });
    });

    grunt.registerTask("compile", ["exec:ts", "exec:rollup", "append:umdDeclaration"]);

    grunt.registerTask("build-release", ["compile", "exec:tslint", "uglify", "clean", "copy"]);

    // compile, lint, minify, clean copy to release folder
    grunt.registerTask("prepare-release", "Prepare a release by building release files and bumping version", function (bump) {
        if (!bump) {
            grunt.log.error("You must specify the version bump! See https://github.com/vojtajina/grunt-bump/tree/v0.7.0");
            return;
        }
        grunt.task.run("build-release", "bump-only:" + bump, "copy");
    });

    // serve release files
    grunt.registerTask("serve-release", "serve release files for checking that release files have no issues", ["connect:release", "watch:resources"]);

    // publish a prepared release
    grunt.registerTask("publish-release", ["bump-commit"]);

    // default task for developers to start coding
    grunt.registerTask("default", ["connect:dev", "watch"]);
};
