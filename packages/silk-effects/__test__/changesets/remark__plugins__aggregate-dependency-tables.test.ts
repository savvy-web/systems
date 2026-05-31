import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import { AggregateDependencyTablesPlugin } from "../../src/changesets/remark/plugins/aggregate-dependency-tables.js";

function transform(md: string): string {
	return unified()
		.use(remarkParse)
		.use(remarkGfm)
		.use(AggregateDependencyTablesPlugin)
		.use(remarkStringify)
		.processSync(md)
		.toString();
}

const TABLE_HEADER = `| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |`;

describe("AggregateDependencyTablesPlugin", () => {
	it("passes through a single dependency table unchanged (but sorted)", () => {
		const md = `## 1.0.0

### Dependencies

${TABLE_HEADER}
| zlib | dependency | updated | 1.0.0 | 2.0.0 |
| axios | dependency | updated | 0.1.0 | 0.2.0 |
`;
		const result = transform(md);
		// Should be sorted: axios before zlib
		const axiosIdx = result.indexOf("axios");
		const zlibIdx = result.indexOf("zlib");
		expect(axiosIdx).toBeLessThan(zlibIdx);
	});

	it("merges two dependency tables in one version block", () => {
		const md = `## 1.0.0

### Dependencies

${TABLE_HEADER}
| foo | dependency | updated | 1.0.0 | 2.0.0 |

### Dependencies

${TABLE_HEADER}
| bar | devDependency | updated | 3.0.0 | 4.0.0 |
`;
		const result = transform(md);
		// Should have exactly one ### Dependencies heading
		const headingCount = (result.match(/### Dependencies/g) || []).length;
		expect(headingCount).toBe(1);
		// Both deps should be present
		expect(result).toContain("foo");
		expect(result).toContain("bar");
	});

	it("collapses same package across tables", () => {
		const md = `## 1.0.0

### Dependencies

${TABLE_HEADER}
| foo | dependency | updated | 1.0.0 | 2.0.0 |

### Dependencies

${TABLE_HEADER}
| foo | dependency | updated | 2.0.0 | 3.0.0 |
`;
		const result = transform(md);
		// Should collapse to 1.0.0 → 3.0.0
		expect(result).toContain("1.0.0");
		expect(result).toContain("3.0.0");
		expect(result).not.toContain("2.0.0");
	});

	it("handles independent version blocks separately", () => {
		const md = `## 2.0.0

### Dependencies

${TABLE_HEADER}
| foo | dependency | updated | 1.0.0 | 2.0.0 |

## 1.0.0

### Dependencies

${TABLE_HEADER}
| bar | dependency | updated | 0.1.0 | 0.2.0 |
`;
		const result = transform(md);
		expect(result).toContain("foo");
		expect(result).toContain("bar");
		const headingCount = (result.match(/### Dependencies/g) || []).length;
		expect(headingCount).toBe(2);
	});

	it("preserves legacy bullet lists below the table", () => {
		const md = `## 1.0.0

### Dependencies

${TABLE_HEADER}
| foo | dependency | updated | 1.0.0 | 2.0.0 |

- legacy-pkg: 1.0.0 → 2.0.0
`;
		const result = transform(md);
		expect(result).toContain("foo");
		expect(result).toContain("legacy-pkg");
	});

	it("leaves non-Dependencies sections untouched", () => {
		const md = `## 1.0.0

### Features

- Added feature X

### Dependencies

${TABLE_HEADER}
| foo | dependency | updated | 1.0.0 | 2.0.0 |
`;
		const result = transform(md);
		expect(result).toContain("### Features");
		expect(result).toContain("Added feature X");
	});

	it("drops section when all rows collapse to nothing", () => {
		const md = `## 1.0.0

### Features

- Added feature X

### Dependencies

${TABLE_HEADER}
| foo | dependency | added | \u2014 | 1.0.0 |

### Dependencies

${TABLE_HEADER}
| foo | dependency | removed | 1.0.0 | \u2014 |
`;
		const result = transform(md);
		// Dependencies section should be dropped (net zero)
		expect(result).not.toContain("### Dependencies");
		// Features should remain
		expect(result).toContain("### Features");
	});
});
