import { expect } from "chai";
import { DemoPage } from "../pages/demo.page";

describe( "baseline", function() {

    const demoPage = new DemoPage();

    it( "checks if browser handles drag and drop natively", function() {

        // try max. three times
        this.retries( 2 );

        demoPage.open( true );

        expect( demoPage.header.getText() ).to.contain( "mobile-drag-drop" );

        demoPage.dragItemToDropzone();
    } );
} );
