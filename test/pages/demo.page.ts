export class DemoPage {

    public get header() {

        return browser.element( "#wrapper header h1" );
    }

    public get dropzone() {

        return browser.element( "#innerBin" );
    }

    public open():void {

        browser.url( "/demo" );
    }

    public dragItemToDropzone() {

        const draggableSelector = "#one";
        const draggableElement = browser.element( draggableSelector );
        const draggableLocation:WebdriverIO.Position = draggableElement.getLocation() as any;
        const draggableSize:WebdriverIO.Size = draggableElement.getElementSize();

        const dropzoneElement = this.dropzone;
        const dropzoneLocation:WebdriverIO.Position = dropzoneElement.getLocation() as any;
        const dropzoneSize:WebdriverIO.Size = dropzoneElement.getElementSize();

        //TODO detect environment and set offset accordingly because touches are relative to screen not webview
        const SAFARI_MAGIC_NATIVE_UI_OFFSET = 69;

        const startPosition:WebdriverIO.Position = {
            x: draggableLocation.x + (draggableSize.width / 2),
            y: draggableLocation.y + (draggableSize.height / 2) + SAFARI_MAGIC_NATIVE_UI_OFFSET
        };

        const endPosition:WebdriverIO.Position = {
            x: dropzoneLocation.x + (dropzoneSize.width / 2),
            y: dropzoneLocation.y + (dropzoneSize.height / 2) + SAFARI_MAGIC_NATIVE_UI_OFFSET
        };

        browser.touchMultiPerform( [
            { action: "press", options: { ...startPosition } },
            { action: "wait", options: { ms: 200 } },
            { action: "moveTo", options: { ...endPosition, ms: 2000 } },
            { action: "wait", options: { ms: 1000 } },
            { action: "release" },
            { action: "wait", options: { ms: 1000 } },
        ] );

        browser.waitForExist( draggableSelector, 500, true );
    }
}