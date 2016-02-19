`TODO integrate travis ci, write unit and end2end tests (saucelabs?). if any browser starts to behave differently we should notice it.`

# Polyfill for HTML 5 drag'n'drop

The HTML 5 drag'n'drop API allows you to implement drag'n'drop on [most desktop browsers](http://caniuse.com/#search=drag). 

Unfortunately, you'll notice most mobile browsers don't support it, so no iPad (or Nexus) action for you!

Luckily, browsers give us enough tools to make it happen ourselves. If you drop
this package in your page your existing HTML 5 drag'n'drop code should just work.


## Demos

`TODO demo page containing all the different things that need to be working as a test base and to show capabilities/spec compliance`

[Demo](http://reppners.github.io/ios-html5-drag-drop-shim/spec-compliance/)

Check out the demo to see it in action and monitor the console to see the events firing.


## Install

**Install**

`bower install drag-drop-webkit-mobile --save`


**Include**

```HTML
<meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1, maximum-scale=1, minimum-scale=1">
<link rel="stylesheet" href="bower_components/drag-drop-webkit-mobile/mobile-drag-and-drop-polyfill.css">
<script src="bower_components/drag-drop-webkit-mobile/mobile-drag-and-drop-polyfill.min.js"></script>
```
_The meta viewport tag is needed because mobile browsers zoom out when something is dragged close to the right edge of the screen._
_While this may be a good intent to give the user an overview on where he is and where he could drop something, it is quite choppy and interrupting UX._
_You can try it out yourself and see what suits your application best ;)_

**Initialize**

```JavaScript
var options = {
    log: function() {
        // activate logging by implementing this method
        var msg = "dnd-poly: ";
        for (var i = 0; i < arguments.length; i++) {
            msg += arguments[i];
        }
        console.log(msg);
    },
    dragImageClass: "my-custom-drag-image-style",
    debug: false
}
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
        log?:( ...args:any[] ) => void; // switch on/off logging by providing log fn
        dragImageClass?:string;         // add custom class to dragImage
        scrollThreshold?:number         // threshold in px. when distance between viewport edge and touch position is smaller start programmatic scroll.
        scrollVelocity?:number          // how much px will be scrolled per animation frame iteration
        debug?:boolean                  // debug mode, which will highlight drop target, immediate user selection and events fired as you interact.
    }
    /**
    * The polyfill must be actively initialized.
    * At this point you have the ability to pass a config.
    * @param config
    * @constructor
    */
    var Initialize: (config?: Config) => void;
}
```

## Customization

You can provide a custom class that will be added to the dragImage-element via the [options](#options).

The default class will be applied always. Of course you are free to specify any overrides on the default class.

```CSS
.mobile-dnd-poly-drag-image {
    opacity: .5;
}
/* applied when the drag effect is none and the operation ends */
.mobile-dnd-poly-drag-image.snapback {
    -webkit-transition: -webkit-transform 250ms ease-out;
    -moz-transition: -moz-transform 250ms ease-out;
    -o-transition: -o-transform 250ms ease-out;
    transition: transform 250ms ease-out;
}
/* applied always as a base class for drop effect styles */
.mobile-dnd-poly-drag-icon {
}
```

Also there will be classes applied to the `dragImage`-element according to the
current drop effect/operation on dragging: `none`, `copy`, `move`, `link`.

There is a CSS-file you can drop in that defines default styles and icons:

```HTML
<link rel="stylesheet" href="bower_components/drag-drop-webkit-mobile/mobile-drag-and-drop-polyfill-icons.css">
```

`Note: Support for setDragImage() to override the dragImage has not yet arrived, contributions are welcome.`


## Compatibility and known issues

| Browser                          |  Support                 |  Known issues                                  |
| -------------------------------- | ------------------------ | ---------------------------------------------- |
| Chrome                           |  Native                  |  No known issues. [More info](#chrome-issues)  |
| Firefox                          |  Native                  |  No known issues. [More info](#firefox-issues) |
| Safari                           |  Native                  |  No known issues.                              |
| Opera                            |  Native                  |  Same as Chrome.                               |
| Internet Explorer 11             |  Native                  |  No known issues.                              |
| Edge                             |  Unknown                 |  Unknown                                       |
| Mobile Safari                    |  Polyfill                |  No known issues.                              |
| Chrome on iOS                    |  Polyfill                |  No known issues.                              |
| Chrome on Android                |  Polyfill                |  No known issues.                              |
| Chrome on touch device           |  Polyfill                |  No known issues. [More info](#chrome-issues)  |
| Firefox on touch device          |  Native                  |  No known issues.                              |
| Firefox on Android               |  Polyfill                |  No known issues. [More info](#firefox-android-issues) |
| Amazon Silk                      |  Unknown                 |  Unknown                                       |
| Ubuntu Phone                     |  Polyfill                |  No known issues.                              |
| IEMobile                         |  Native                  |  Unknown                                       |

**Chrome: <a name="chrome-issues"></a>**
Chrome supports touch devices/events. When run on a desktop touch device like MS Surface it turns on touch events
which also disables native drag and drop support. Touch events can also be set by a user in `chrome://flags` to `auto`, `on`, `off`.   
Also there is a flag for enabling drag and drop through touch interaction but only for Windows and the option is off by default.
The polyfill still works if this setting is active. We cannot detect if this flag is set so we just stick to applying the polyfill
when Chrome is detect with touch events enabled.

**Firefox: <a name="firefox-issues"></a>**
Touch events can be activated by a user in `about:config` to `0` (off), `1` (on), `2`(auto).
As of today (FF39.0) touch behavior is off.
When touch events are active drag and drop interaction will still work, so no need to polyfill.

**Firefox on Android: <a name="firefox-android-issues"></a>**
No critical issues but UX suffers because of the constantly [scrolling location bar](https://bugzilla.mozilla.org/show_bug.cgi?id=1044370).

`TODO test where support is still unknown and try to discover any issues`

`TODO keep an eye out for pointer-event support as this will become a common event api for user interaction wether it be touch, stylus, mouse`


## Cross-browser differences in HTML5 drag'n'drop API

| **Browser** | **dragstart**                            | **drag** | **dragend** | **dragenter**                                    | **dragover**                          | **dragleave** | **dragexit** |
| ----------- | ---------------------------------------- | -------- | ----------- | ------------------------------------------------ | ------------------------------------- | ------------- | ------------ |
| Firefox     | `event.dataTransfer.setData(type, data)` |          |             | [effectAllowed,dropEffect](#ff-quirk)            | [effectAllowed,dropEffect](#ff-quirk) |               |              |
| IE11        |                                          |          |             | `event.preventDefault()` when registered on body |                                       |               |              |
| Polyfill    |                                          |          |             | `event.preventDefault()` or `dropzone` required  |                                       |               |              |

_empty cells mean there is nothing special to take into account_

**Further notices:**

*   If you don't have a `dragenter`-handler registered, drag operation is silently allowed. Browsers don't implement `dropzone`-attribute
    according to [caniuse](http://caniuse.com/#search=drag) so they allow it by default, which violates the spec. 
    If you have a handler set up you have to call `event.preventDefault()` to allow dropping.
    This is pretty bad for the polyfill since JS doesn't allow to check how many listeners were invoked when the event is dispatched,
    which forces the polyfill to rely on a listener being present calling `event.preventDefault()` to make the it work.
*   FF:<a name="ff-quirk"></a> If you set `effectAllowed` or `dropEffect` in dragstart you need to set them in `dragenter/dragover` also.
*   When using an MS Surface tablet a drag and drop operation is initiated by touch and hold on a draggable.
*   IE11 and Chrome scroll automatically when dragging close to a viewport edge.

**Baseline recommendations for cross-browser support:**

* Always set drag data on `dragstart` by calling `event.dataTransfer.setData(type, data)`. This is the expected behavior defined by the spec.
* Always handle `dragenter`-event on possible dropzones when you want to allow the drop by calling `event.preventDefault()`. This is expected behavior defined by the spec.
* Handle `dragover`-event on dropzone when you want to allow the drop by calling `event.preventDefault()`, otherwise the drag operation is aborted. This is expected behavior defined by the spec.


## Contribute

Contributions are welcome. I tried to comment as much as possible and provide a few grunt tasks for making it easy to get involved.
The HTML5 spec on drag and drop should altough be your first read if you're new to the topic:
https://html.spec.whatwg.org/multipage/interaction.html#dnd

The project uses TypeScript as main language for several reasons:
* type-safety & compiler support for easier maintenance
* easily switch to ES6 when its ready

To start working head to your terminal after checkout and execute:

1. `npm install`

2. `grunt`

3. start coding :)

## Thanks

To the [amazing contributors](https://github.com/timruffles/ios-html5-drag-drop-shim/graphs/contributors) who've provided massive extensions and fixes to the original.

<a href="http://twitter.com/rem">@rem</a> - who created the original demo used to demo this shim's drop-in nature.


## License

[BSD 2 License](LICENSE)
