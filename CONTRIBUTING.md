
# Contributing

Get started with

`npm install`

`npm start`
_(will start a watch on typescript files, setup a development server with live-reload and perform initial compilation)_

Thats it :) the browser should automatically open at the demo page served on port 8000.

The HTML5 spec on drag-and-drop should although be your first read if you're new to the topic:
https://html.spec.whatwg.org/multipage/interaction.html#dnd

The project uses [TypeScript](http://www.typescriptlang.org) as main language for several reasons:
* type-safety & compiler support for easier maintenance
* easily switch to ES6 when its ready
* inline documentation through types in place
* easily document API

Internally this project uses [grunt](http://gruntjs.com) as a task runner but all necessary 
commands are available as npm scripts to abstract away the current task runner of choice.


## Debugging

For debugging purposes run with `npm start` and set `const DEBUG = true;` in the `constants.ts` file.
This will result in verbose console output that helps to track down issues.

To get visual feedback on the state of the drag-and-drop operation additionally include `drag-drop-polyfill-debug.css`.


## Releasing
_for maintainers only_

[grunt-bump](https://github.com/vojtajina/grunt-bump/tree/v0.7.0) is used for raising version numbers in package.json and bower.json, committing and tagging.

* make sure repo is in a clean state (after having merged PRs or committed changes to sources)
* run `npm run release:prepare:VERSION_BUMP` where `VERSION_BUMP` is the raise of version (`patch`, `minor`, `major`, `prerelease`)
* run `npm run release:serve` to check if everything runs fine (here would be the right place for automated tests)
* update `CHANGELOG.md` with notes about the prepared release
* run `npm run release:publish` to commit, tag and push the release
