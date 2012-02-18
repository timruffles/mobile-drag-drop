# iOS shim for HTML 5 drag'n'drop

The HTML 5 drag'n'drop API allows you to implement drag'n'drop
with the same code on all desktop browsers. Unfortunately, iOS doesn't
support it, so no iPad action for you!

Luckily, WebKit gives us enough tools to shim seamlessly. If you drop
this script in your page your existing HTML 5 drag'n'drop code should
just work.

Check out the demo to see it in action.

## What doesn't work

* `touchenter` - [iOS doesn't fire it](https://developer.apple.com/library/ios/#documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html#//apple_ref/doc/uid/TP40006511-SW5), and I can't see a way to shim it
  * `mouseover` can't help as
because [iOS only fires it on press](https://developer.apple.com/library/ios/#DOCUMENTATION/AppleApplications/Reference/SafariWebContent/CreatingContentforSafarioniPhone/CreatingContentforSafarioniPhone.html#//apple_ref/doc/uid/TP40006482-SW21).
