/**
 * Global Vitest setup
 * Runs once before all test files
 *
 * Loads .act.secrets into process.env for integration tests.
 * The file uses dotenv format with multiline values in double quotes.
 */
import { existsSync, readFileSync } from "node:fs";

const SECRETS_FILE = ".act.secrets";

if (existsSync(SECRETS_FILE)) {
	const content = readFileSync(SECRETS_FILE, "utf-8");
	const regex = /^([A-Z_]+)="([\s\S]*?)"\s*$|^([A-Z_]+)=(.*)$/gm;
	for (const match of content.matchAll(regex)) {
		const key = match[1] ?? match[3];
		const value = match[2] ?? match[4];
		if (key && value && !process.env[key]) {
			process.env[key] = value;
		}
	}
}
