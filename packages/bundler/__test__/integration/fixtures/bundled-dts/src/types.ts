// A type whose canonical declaration lives in a deep sub-module that the package
// does NOT expose as a public export subpath. Re-exporting it through the root
// entry is exactly the TS2883 portability hazard the bundled-dts pass fixes.
export interface DeepWidget {
	readonly kind: "deep-widget";
	readonly size: number;
}
