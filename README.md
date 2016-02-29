`TODO tests? fancy state icons?`
`TODO add notes about file size`

# Polyfill for HTML 5 drag'n'drop

The HTML 5 drag'n'drop API allows you to implement drag'n'drop on [most desktop browsers](http://caniuse.com/#search=drag). 

Unfortunately, you'll notice most mobile browsers don't support it, so no iPad (or Nexus) action for you!

Luckily, browsers give us enough tools to make it happen ourselves. If you drop
this package in your page your existing HTML 5 drag'n'drop code should just work.


## Demos

`TODO demo page containing all the different things that need to be working as a test base and to show capabilities/spec compliance/limitations`

[Demo](http://reppners.github.io/ios-html5-drag-drop-shim/spec-compliance/)

Check out the demo to see it in action and monitor the console to see the events firing.


## Install

**bower**

`bower install drag-drop-webkit-mobile --save`

**npm**

`npm install drag-drop-webkit-mobile --save`

**jspm**

`jspm install npm:drag-drop-webkit-mobile`

### Include

**global**

```HTML
<link rel="stylesheet" href="libs/drag-drop-webkit-mobile/mobile-drag-and-drop-polyfill.css">
<script src="libs/drag-drop-webkit-mobile/mobile-drag-and-drop-polyfill.min.js"></script>
```

**SystemJS/JSPM**

```JavaScript
System.import("drag-drop-webkit-mobile");
System.import("drag-drop-webkit-mobile/mobile-drag-and-drop-polyfill.css!");
```

**ES6/TypeScript flavour**

```JavaScript
import "drag-drop-webkit-mobile";
import "drag-drop-webkit-mobile/mobile-drag-and-drop-polyfill.css!";
```

### Initialize

```JavaScript
// options are optional ;)
MobileDragAndDropPolyfill.Initialize(options);
```

## API & Options <a name="options"></a>

```TypeScript
declare module MobileDragAndDropPolyfill {
    /**
    * polyfill config
    */
    interface Config {
            // useful for when you want the default drag image but still want to apply
            // some static offset from touch coordinates to drag image coordinates
            // defaults to (0,0)
            dragImageOffset?:Point;
            // if the dragImage shall be centered on the touch coordinates
            // defaults to false
            dragImageCenterOnTouch?:boolean;
            // the drag-and-drop operation involves some processing. here you can specify in what interval this processing takes place.
            // defaults to 150ms
            iterationInterval?:number;
            // hook for custom logic that decides if a drag-operation should start
            dragStartConditionOverride?:( event:TouchEvent ) => boolean;
            // hook for custom logic that decides if and where the drag image should translate
            dragImageTranslateOverride?:( event:TouchEvent,         // touchmove event
                                          hoverCoordinates:Point,   // the processed touch event viewport coordinates
                                          hoveredElement:HTMLElement,   // the element under the calculated touch coordinates
                                          translateDragImageFn:( offsetX:number, offsetY:number ) => void ) => boolean; // updates the drag image position
            // hook for custom logic that can trigger a default event based on the original touch event when the drag never started
            defaultActionOverride?:( event:TouchEvent ) => boolean;
        }
    /**
    * The polyfill must be actively initialized.
    * At this point you have the ability to pass a config.
    */
    function Initialize(config?: Config) => void;
}
```

## DragImage Customization

Override the classes that are applied by the polyfill. Mind the `!important`.

```CSS
.mobile-dnd-poly-drag-image {
    opacity: .5 !important;
}
/* applied when the drag effect is none and the operation ends */
.mobile-dnd-poly-drag-image.snapback {
    -webkit-transition: -webkit-transform 250ms ease-out !important;
    -moz-transition: -moz-transform 250ms ease-out !important;
    -o-transition: -o-transform 250ms ease-out !important;
    transition: transform 250ms ease-out !important;
}
/* applied always as a base class for drop effect styles */
.mobile-dnd-poly-drag-icon {
}
```

CSS classes are applied to the `dragImage`-element according to the
current drop effect: `none`, `copy`, `move`, `link`.

There is a CSS-file you can drop in that defines default styles and icons.

```HTML
<link rel="stylesheet" href="bower_components/drag-drop-webkit-mobile/mobile-drag-and-drop-polyfill-icons.css">
```

`setDragImage()` is supported. This enables you to set a custom drag image.

## Usage Examples

`TODO`

## Known issues and limitations

* Currently does not work with `iFrames`. Contributions welcome.

* `dragStartConditionOverride` `TODO`

## Browser compatibility

| Browser                          |  Support                 |  Known issues                                  |
| -------------------------------- | ------------------------ | ---------------------------------------------- |
| Chrome                           |  Native                  |  No known issues. [More info](#chrome-issues)  |
| Firefox                          |  Native                  |  No known issues. [More info](#firefox-issues) |
| Safari                           |  Native                  |  No known issues.                              |
| Opera                            |  Native                  |  Same as Chrome.                               |
| Internet Explorer 11             |  Native                  |  No known issues.                              |
| Edge                             |  **Unknown**             |  **Unknown**                                   |
| Mobile Safari                    |  Polyfill                |  No known issues.                              |
| Chrome on iOS                    |  Polyfill                |  No known issues.                              |
| Chrome on Android                |  Polyfill                |  No known issues.                              |
| Chrome on touch device           |  Polyfill                |  No known issues. [More info](#chrome-issues)  |
| Firefox on touch device          |  Native                  |  No known issues.                              |
| Firefox on Android               |  Polyfill                |  No known issues. [More info](#firefox-android-issues) |
| Amazon Silk                      |  **Unknown**             |  **Unknown**                                   |
| Ubuntu Phone                     |  Polyfill                |  No known issues.                              |
| IEMobile                         |  Native                  |  **Unknown**                                   |

**Chrome: <a name="chrome-issues"></a>**
Chrome supports touch devices/events. When run on a desktop touch device like MS Surface it turns on touch events
which also disables native drag-and-drop support. Touch events can also be set by a user in `chrome://flags` to `auto`, `on`, `off`.   
There is also a flag for enabling drag-and-drop through touch interaction but only for Windows and the option is off by default.
The polyfill still works if this setting is active. We cannot detect if this flag is set so we just stick to applying the polyfill
when Chrome is detected with touch events enabled.

**Firefox: <a name="firefox-issues"></a>**
Touch events can be activated by a user in `about:config` to `0` (off), `1` (on), `2`(auto).
As of today (FF39.0) touch behavior is off.
When touch events are active drag-and-drop interaction will still work, so no need to polyfill.

**Firefox on Android: <a name="firefox-android-issues"></a>**
No critical issues but UX suffers because of the constantly [scrolling location bar](https://bugzilla.mozilla.org/show_bug.cgi?id=1044370).

`TODO test where support is still unknown and try to discover any issues`

## Cross-browser differences in HTML5 drag'n'drop API

| **Browser** | **dragstart**                            | **drag** | **dragend** | **dragenter**                                    | **dragover**                          | **dragleave** | **dragexit** |
| ----------- | ---------------------------------------- | -------- | ----------- | ------------------------------------------------ | ------------------------------------- | ------------- | ------------ |
| Firefox     | `event.dataTransfer.setData(type, data)` |          |             | [effectAllowed,dropEffect](#ff-quirk)            | [effectAllowed,dropEffect](#ff-quirk) |               |              |
| IE11        |                                          |          |             | `event.preventDefault()` when registered on body |                                       |               |              |
| Polyfill    |                                          |          |             | `event.preventDefault()` or `dropzone` required  |                                       |               |              |

_empty cells mean there is nothing special to take into account_

**Further notices:**

*   If you don't have a `dragenter`-handler registered, drag-operation is silently allowed. Browsers don't implement `dropzone`-attribute
    according to [caniuse](http://caniuse.com/#search=drag) so they allow it by default, which violates the spec. 
    If you have a handler set up you have to call `event.preventDefault()` to allow dropping.
    This is pretty bad for the polyfill since JS doesn't allow to check how many listeners were invoked when the event is dispatched,
    which forces the polyfill to rely on a listener being present calling `event.preventDefault()` to make it work.
*   FF:<a name="ff-quirk"></a> If you set `effectAllowed` or `dropEffect` in `dragstart` you need to set them in `dragenter/dragover` also.
*   When using a MS Surface tablet a drag-operation is initiated by touch and hold on a draggable.
*   IE11 and Chrome scroll automatically when dragging close to a viewport edge.

**Baseline recommendations for cross-browser/-platform support:**

* Always set drag data on `dragstart` by calling `event.dataTransfer.setData(type, data)`.
* Always handle `dragenter`-event on possible dropzones when you want to allow the drop by calling `event.preventDefault()`.
* Handle `dragover`-event on dropzone when you want to allow the drop by calling `event.preventDefault()`, otherwise the drag-operation is aborted.


## Contribute

Contributions are welcome. There are [grunt](http://gruntjs.com) tasks for making it easy to get started.

The HTML5 spec on drag-and-drop should altough be your first read if you're new to the topic:
https://html.spec.whatwg.org/multipage/interaction.html#dnd

The project uses [TypeScript](http://www.typescriptlang.org) as main language for several reasons:
* type-safety & compiler support for easier maintenance
* easily switch to ES6 when its ready

**Getting started**

`npm install`

`grunt` _(will start a watch on typescript files, setup a development server with live-reload and do an initial transpilation and linting)_

start coding :) the browser should be automatically opened at the test page served on port 8000.

**Debugging**

For debugging purposes you can include the non-minified polyfill and define `var DEBUG;` before you `Initialize()`. 
This will result in verbose console output that helps to track down issues.

Set `var DEBUG = true;` and include `mobile-drag-and-drop-polyfill-debug.css` to get visual feedback on the state
of the drag-and-drop operation.


## Thanks

To the [amazing contributors](https://github.com/timruffles/ios-html5-drag-drop-shim/graphs/contributors) who've provided massive extensions and fixes to the original.

<a href="http://twitter.com/rem">@rem</a> - who created the original demo used to demo this shim's drop-in nature.


## License

[BSD 2 License](LICENSE)
