import { Data } from "effect";

/**
 * Raised when publishability detection selects a directory that the package's
 * `dist/prod/targets.json` binding does not describe.
 *
 * @remarks
 * The bundler's prod build writes `targets.json` naming every byte-group
 * directory it produced. Once that binding exists it is authoritative: the only
 * directories whose bytes may be published are the ones it lists. A detector
 * that returns anything else — most often `publishConfig.directory` pointing at
 * a **dev** build, because silk mode was misdetected — is about to pack an
 * unresolved workspace manifest and ship it to a registry.
 *
 * That is the `yaml-effect@0.7.1` failure: detection picked `dist/dev/pkg`, the
 * dev manifest still carried `catalog:` specifiers, and the published package
 * was uninstallable (`EUNSUPPORTEDPROTOCOL`).
 *
 * @since 3.1.0
 * @public
 */
export class PublishTargetBindingError extends Data.TaggedError("PublishTargetBindingError")<{
	/** The package whose targets were being resolved. */
	readonly pkg: string;
	/** The directory detection selected, relative to the package root. */
	readonly directory: string;
	/** The group directories the prod binding actually describes. */
	readonly boundDirectories: ReadonlyArray<string>;
}> {
	get message() {
		return (
			`Package ${this.pkg} resolved publish directory "${this.directory}", which is not one of the ` +
			`directories bound by dist/prod/targets.json (${this.boundDirectories.join(", ")}). ` +
			`This means publishability detection did not select the prod build output — refusing to publish ` +
			`before packing an unresolved manifest.`
		);
	}
}
