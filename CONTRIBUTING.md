
# Contributing

There are [grunt](http://gruntjs.com) tasks for making it easy to get started:

`npm install`

`grunt`
_(will start a watch on typescript files, setup a development server with live-reload and perform initial compilation)_

Thats it :) the browser should automatically open at the demo page served on port 8000.

The HTML5 spec on drag-and-drop should although be your first read if you're new to the topic:
https://html.spec.whatwg.org/multipage/interaction.html#dnd

The project uses [TypeScript](http://www.typescriptlang.org) as main language for several reasons:
* type-safety & compiler support for easier maintenance
* easily switch to ES6 when its ready
* inline documentation through types in place
* easily document API


## Debugging

For debugging purposes use the non-minified sources and define `var DEBUG = true;` before `Initialize()`.
This will result in verbose console output that helps to track down issues.

To get visual feedback on the state of the drag-and-drop operation additionaly include `drag-drop-polyfill-debug.css`.


## Releasing
_for maintainers only_

[grunt-bump](https://github.com/vojtajina/grunt-bump/tree/v0.7.0) is used for raising version numbers in package.json and bower.json, committing and tagging.

* make sure repo is in a clean state (after having merged PRs or committed changes to sources)
* run `grunt prepare-release:VERSION_BUMP` where `VERSION_BUMP` is the raise of version (`patch`, `minor`, `major`, `prerelease`, ``, ...)
* run `grunt serve-release` to check if everything runs fine (here would be the right place for automated tests)
* update `CHANGELOG.md` with notes about the prepared release
* run `grunt publish-release` to commit, tag and push the release
