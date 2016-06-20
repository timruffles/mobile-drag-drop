
# Contribute

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
* API documentation through types in place

## Debugging

For debugging purposes use the non-minified sources and define `var DEBUG = true;` before `Initialize()`.
This will result in verbose console output that helps to track down issues.

To get visual feedback on the state of the drag-and-drop operation additionaly include `drag-drop-polyfill-debug.css`.


## Release

`TODO how to release`
