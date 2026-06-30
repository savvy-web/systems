export const VERSION: string = process.env.__PACKAGE_VERSION__ ?? "0.0.0";
export const greet = (name: string): string => `hello, ${name}`;
