/**
 * Tests for typed error classes using Effect's Data.TaggedError.
 */
import { describe, expect, it } from "vitest";
import {
	ActionYmlMissing,
	ActionYmlSchemaError,
	ActionYmlSyntaxError,
	BuildFailed,
	BundleFailed,
	CleanError,
	ConfigInvalid,
	ConfigLoadFailed,
	ConfigNotFound,
	EntryFileMissing,
	MainEntryMissing,
	PersistLocalError,
	ValidationFailed,
	WriteError,
} from "./errors.js";

describe("Config Errors", () => {
	describe("ConfigNotFound", () => {
		it("has correct _tag", () => {
			const error = new ConfigNotFound({ path: "/path/to/config" });
			expect(error._tag).toBe("ConfigNotFound");
		});

		it("stores path property", () => {
			const error = new ConfigNotFound({ path: "/path/to/config", message: "Not found" });
			expect(error.path).toBe("/path/to/config");
			expect(error.message).toBe("Not found");
		});
	});

	describe("ConfigInvalid", () => {
		it("has correct _tag", () => {
			const error = new ConfigInvalid({ path: "/config.ts", errors: ["Invalid field"] });
			expect(error._tag).toBe("ConfigInvalid");
		});

		it("stores errors array", () => {
			const errors = ["Error 1", "Error 2"];
			const error = new ConfigInvalid({ path: "/config.ts", errors });
			expect(error.errors).toEqual(errors);
		});
	});

	describe("ConfigLoadFailed", () => {
		it("has correct _tag", () => {
			const error = new ConfigLoadFailed({ path: "/config.ts", cause: "Import failed" });
			expect(error._tag).toBe("ConfigLoadFailed");
		});

		it("stores cause", () => {
			const error = new ConfigLoadFailed({ path: "/config.ts", cause: "Syntax error" });
			expect(error.cause).toBe("Syntax error");
		});

		it("preserves Error object as cause", () => {
			const original = new Error("Import failed");
			const error = new ConfigLoadFailed({ path: "/config.ts", cause: original });
			expect(error.cause).toBe(original);
			expect((error.cause as Error).stack).toBeDefined();
		});
	});
});

describe("Validation Errors", () => {
	describe("MainEntryMissing", () => {
		it("has correct _tag", () => {
			const error = new MainEntryMissing({ expectedPath: "src/main.ts", cwd: "/project" });
			expect(error._tag).toBe("MainEntryMissing");
		});

		it("stores expected path and cwd", () => {
			const error = new MainEntryMissing({ expectedPath: "src/main.ts", cwd: "/project" });
			expect(error.expectedPath).toBe("src/main.ts");
			expect(error.cwd).toBe("/project");
		});
	});

	describe("EntryFileMissing", () => {
		it("has correct _tag", () => {
			const error = new EntryFileMissing({ entryType: "pre", path: "src/pre.ts" });
			expect(error._tag).toBe("EntryFileMissing");
		});

		it("stores entry type", () => {
			const error = new EntryFileMissing({ entryType: "post", path: "src/post.ts" });
			expect(error.entryType).toBe("post");
		});
	});

	describe("ActionYmlMissing", () => {
		it("has correct _tag", () => {
			const error = new ActionYmlMissing({ cwd: "/project" });
			expect(error._tag).toBe("ActionYmlMissing");
		});
	});

	describe("ActionYmlSyntaxError", () => {
		it("has correct _tag", () => {
			const error = new ActionYmlSyntaxError({ path: "/action.yml", message: "Invalid YAML" });
			expect(error._tag).toBe("ActionYmlSyntaxError");
		});

		it("stores optional line and column", () => {
			const error = new ActionYmlSyntaxError({
				path: "/action.yml",
				message: "Unexpected token",
				line: 5,
				column: 10,
			});
			expect(error.line).toBe(5);
			expect(error.column).toBe(10);
		});
	});

	describe("ActionYmlSchemaError", () => {
		it("has correct _tag", () => {
			const error = new ActionYmlSchemaError({
				path: "/action.yml",
				errors: [{ path: "runs.using", message: "Invalid value" }],
			});
			expect(error._tag).toBe("ActionYmlSchemaError");
		});

		it("stores structured errors", () => {
			const errors = [
				{ path: "name", message: "Required" },
				{ path: "runs.using", message: "Must be node16 or node20" },
			];
			const error = new ActionYmlSchemaError({ path: "/action.yml", errors });
			expect(error.errors).toHaveLength(2);
			expect(error.errors[0].path).toBe("name");
		});
	});

	describe("ValidationFailed", () => {
		it("has correct _tag", () => {
			const error = new ValidationFailed({ errorCount: 2, warningCount: 1, message: "Failed" });
			expect(error._tag).toBe("ValidationFailed");
		});

		it("stores counts", () => {
			const error = new ValidationFailed({ errorCount: 3, warningCount: 5, message: "Validation failed" });
			expect(error.errorCount).toBe(3);
			expect(error.warningCount).toBe(5);
		});
	});
});

describe("Build Errors", () => {
	describe("BundleFailed", () => {
		it("has correct _tag", () => {
			const error = new BundleFailed({ entry: "src/main.ts", cause: "ncc error" });
			expect(error._tag).toBe("BundleFailed");
		});

		it("stores entry and cause", () => {
			const error = new BundleFailed({ entry: "src/main.ts", cause: "Import resolution failed" });
			expect(error.entry).toBe("src/main.ts");
			expect(error.cause).toBe("Import resolution failed");
		});

		it("preserves Error object as cause", () => {
			const original = new Error("ncc compilation error");
			const error = new BundleFailed({ entry: "src/main.ts", cause: original });
			expect(error.cause).toBe(original);
			expect((error.cause as Error).stack).toBeDefined();
		});
	});

	describe("WriteError", () => {
		it("has correct _tag", () => {
			const error = new WriteError({ path: "/dist/main.js", cause: "Permission denied" });
			expect(error._tag).toBe("WriteError");
		});

		it("preserves Error object as cause", () => {
			const original = new Error("EACCES: permission denied");
			const error = new WriteError({ path: "/dist/main.js", cause: original });
			expect(error.cause).toBe(original);
			expect((error.cause as Error).stack).toBeDefined();
		});
	});

	describe("CleanError", () => {
		it("has correct _tag", () => {
			const error = new CleanError({ directory: "/dist", cause: "Cannot remove" });
			expect(error._tag).toBe("CleanError");
		});

		it("preserves Error object as cause", () => {
			const original = new Error("EPERM: operation not permitted");
			const error = new CleanError({ directory: "/dist", cause: original });
			expect(error.cause).toBe(original);
			expect((error.cause as Error).stack).toBeDefined();
		});
	});

	describe("BuildFailed", () => {
		it("has correct _tag", () => {
			const error = new BuildFailed({ message: "Build failed", failedEntries: 2 });
			expect(error._tag).toBe("BuildFailed");
		});

		it("stores failed entries count", () => {
			const error = new BuildFailed({ message: "Build failed", failedEntries: 3 });
			expect(error.failedEntries).toBe(3);
		});
	});
});

describe("Persist Errors", () => {
	describe("PersistLocalError", () => {
		it("has correct _tag", () => {
			const error = new PersistLocalError({ path: "/output", cause: "Failed" });
			expect(error._tag).toBe("PersistLocalError");
		});

		it("preserves Error object as cause", () => {
			const original = new Error("ENOSPC: no space left");
			const error = new PersistLocalError({ path: "/output", cause: original });
			expect(error.cause).toBe(original);
			expect((error.cause as Error).stack).toBeDefined();
		});
	});
});

describe("Error Pattern Matching", () => {
	it("supports discriminated union matching via _tag", () => {
		const errors = [
			new ConfigNotFound({ path: "/config" }),
			new ConfigInvalid({ path: "/config", errors: [] }),
			new MainEntryMissing({ expectedPath: "src/main.ts", cwd: "/" }),
		];

		const tags = errors.map((e) => e._tag);
		expect(tags).toEqual(["ConfigNotFound", "ConfigInvalid", "MainEntryMissing"]);
	});

	it("errors are instances of Error", () => {
		const error = new ConfigNotFound({ path: "/config" });
		expect(error).toBeInstanceOf(Error);
	});
});
