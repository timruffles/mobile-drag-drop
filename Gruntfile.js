/* jshint node:true */
'use strict';

module.exports = function(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		jshint: {
			all: ['ios-drag-drop.js'],
			options: {
				eqnull: true
			}
		},
		uglify: {
			options: {
				banner: '/*! <%= pkg.name %> <%= pkg.version %> | Copyright (c) <%= grunt.template.today("yyyy") %> Tim Ruffles | BSD 2 License */'
			},

			build: {
				src: 'ios-drag-drop.js',
				dest: 'ios-drag-drop.min.js'
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-jshint');

	grunt.registerTask('default', [
//		'jshint', Disabled pending fix errors
		'uglify'
	]);
};
