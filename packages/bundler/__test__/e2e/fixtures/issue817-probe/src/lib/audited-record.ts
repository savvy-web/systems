/** @internal */
function withAuditTrail(): new () => {
	/** Created. */
	readonly createdAt: Date;
	/** Updated. */
	updatedAt: Date;
} {
	return class {
		readonly createdAt: Date = new Date();
		updatedAt: Date = new Date();
	};
}
/**
 * A record with an audit trail supplied by a mixin base class.
 * @public
 */
export class AuditedRecord extends withAuditTrail() {
	/** Label. */
	readonly label: string;
	constructor(label: string) {
		super();
		this.label = label;
	}
	/** Touch. */
	touch(): Date {
		this.updatedAt = new Date();
		return this.updatedAt;
	}
}
