`TODO` integrate travis ci, write unit and end2end tests (saucelabs?)

# Polyfill for HTML 5 drag'n'drop

The HTML 5 drag'n'drop API allows you to implement drag'n'drop on [most desktop browsers](http://caniuse.com/#search=drag). 

Unfortunately, you'll notice most mobile browsers don't support it, so no iPad (or Nexus) action for you!

Luckily, browsers give us enough tools to make it happen ourselves. If you drop
this package in your page your existing HTML 5 drag'n'drop code should just work.


## Demos

`TODO`

Check out the demo to see it in action.


## Install/Config

`TODO`


## Customization

`TODO`


## Compatibility table and known issues

| Browser                          |  Support                 |  Known issues                                                                                |
| -------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| Chrome                           |  Native                  |  No known issues.                                                                            |
|                                  |                          |  Chrome supports touch devices/events. When run on a desktop touch device like MS Surface    |
|                                  |                          |  it switches to touches which also disables native drag and drop support.                    |
|                                  |                          |  Touch behaviour can also be set in chrome://flags by a user to "auto", "on", "off".         |
|                                  |                          |  Also there is a configuration for enabling drag and drop through touch interaction but      |
|                                  |                          |  only for Windows and the option is off by default.                                          |
| - - - - - - - - - - - - - - - -  | - - - - - - - - - - - -  | - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  |
| Firefox                          |  Native                  |  Touch behaviour can also be set in about:config by a user to "0" (off), "1" (on), "2"(auto).|
|                                  |                          |  When touches are active drag and drop interaction will still work, so no need to polyfill.  |
| - - - - - - - - - - - - - - - -  | - - - - - - - - - - - -  | - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  |
| Safari                           |  Native                  |  No known issues                                                                             |
| - - - - - - - - - - - - - - - -  | - - - - - - - - - - - -  | - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  |
| Opera                            |  Native                  |  Same as chrome in every aspect since the same engine is used.                               |
| - - - - - - - - - - - - - - - -  | - - - - - - - - - - - -  | - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  |
| Internet Explorer 11             |  Native                  |  No known issues                                                                             |
| - - - - - - - - - - - - - - - -  | - - - - - - - - - - - -  | - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  |
| Edge                             |  Unknown                 |  Unknown                                                                                     |
| - - - - - - - - - - - - - - - -  | - - - - - - - - - - - -  | - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  |
| Mobile Safari                    |  Polyfill                |  `TODO analyze strange behaviour on drag/touchend/cancel when close to the right edge`       |
| - - - - - - - - - - - - - - - -  | - - - - - - - - - - - -  | - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  |
| Chrome on iOS                    |  Polyfill                |  `TODO analyze strange behaviour on drag/touchend/cancel when close to the right edge`       |
| - - - - - - - - - - - - - - - -  | - - - - - - - - - - - -  | - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  |
| Chrome on Android                |  Polyfill                |  `TODO analyze strange behaviour on drag/touchend/cancel when close to the right edge`       |
| - - - - - - - - - - - - - - - -  | - - - - - - - - - - - -  | - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  |
| Chrome on touch device           |  Polyfill                |  No known issues.                                                                            |
|                                  |                          |  There is a configuration for enabling drag and drop through touch interaction but           |
|                                  |                          |  only for Windows and the option is off by default. The polyfill still works if this         |
|                                  |                          |  setting is active. We cannot detect if this flag is set so we just stick to applying        |
|                                  |                          |  the polyfill.                                                                               |
| - - - - - - - - - - - - - - - -  | - - - - - - - - - - - -  | - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  |
| Firefox on touch device          |  Native                  |  No known issues                                                                             |
| - - - - - - - - - - - - - - - -  | - - - - - - - - - - - -  | - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  |
| Firefox on Android               |  Polyfill                |  No known issues besides mobile firefox app behaviour (https://bugzilla.mozilla.org/show_bug.cgi?id=1192182) |
| - - - - - - - - - - - - - - - -  | - - - - - - - - - - - -  | - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  |
| Amazon Silk                      |  Unknown                 |  Unknown                                                                                     |
| - - - - - - - - - - - - - - - -  | - - - - - - - - - - - -  | - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  |
| Ubuntu Phone                     |  Unknown                 |  Unknown                                                                                     |
| - - - - - - - - - - - - - - - -  | - - - - - - - - - - - -  | - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  |
| IEMobile                         |  Native                  |  Unknown                                                                                     |
| - - - - - - - - - - - - - - - -  | - - - - - - - - - - - -  | - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  |
| ...                              |                          |                                                                                              |
| -------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------- |

`TODO test where where support is still unknown and try to discover any issues`
`TODO keep an eye out for pointer-event support as this will become a common event api for user interaction wether it be touch, stylus, mouse`

## Cross-browser differences in HTML5 drag'n'drop API

| **Event**     | Firefox                                  | IE11                                             | Chrome | Chrome on Android                      | (Polyfill)          |
|---------------|------------------------------------------|--------------------------------------------------|--------|----------------------------------------|----------------------
| **dragstart** | `event.dataTransfer.setData(type, data)` |                                                  |        |                                        |                     |
| **drag**      |                                          |                                                  |        |                                        |                     |
| **dragend**   |                                          |                                                  |        |                                        |                     |
| **dragenter** |                                          | `event.preventDefault()` when registered on body |        | `event.preventDefault()` or `dropzone` | `event.preventDefault()` or `dropzone` |
| **dragover**  |                                          |                                                  |        |                                        |                     |
| **dragleave** |                                          |                                                  |        |                                        |                     |
| **dragexit**  |                                          |                                                  |        |                                        |                     |

Further notices:
* If you set `effectAllowed` or `dropEffect` in dragstart you need to set them in `dragenter/dragover` also
* When using an MS Surface tablet a drag and drop operation is initiated by touch and hold on a draggable.
* IE11 and Chrome scroll automatically when dragging close to a viewport edge.
      
---------------------------------------------------------------------------------------------------------------------------------------------------------

#### Baseline recommendations for cross-browser support:

* Always set drag data on `dragstart` by calling `event.dataTransfer.setData(type, data)`.
* Always handle `dragenter`-event on possible dropzones when you want to allow the drop by calling `event.preventDefault()`.
* If you have a `dragenter`-listener on your `body`-element, call `event.preventDefault()` to ensure the drag operation is not aborted prematurely.
* Handle `dragover`-event on dropzone when you want to allow the drop by calling `event.preventDefault()`, otherwise the drag operation is aborted and `drop` never emitted.

## Contribute

`TODO`


## Thanks

To the [amazing contributors](https://github.com/timruffles/ios-html5-drag-drop-shim/graphs/contributors) who've provided massive extensions and fixes to the original.

<a href="http://twitter.com/rem">@rem</a> - who created the original demo used to demo this shim's drop-in nature.


## License

[MIT License](LICENSE)
