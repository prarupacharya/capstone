/** @type {import("jest").Config} */
module.exports = {
  rootDir: ".",
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "jsdom",
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  transform: {
    "^.+\\.[tj]sx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.test.json", useESM: true }]
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
  testMatch: ["<rootDir>/test/**/*.spec.ts", "<rootDir>/test/**/*.spec.tsx"],
  testPathIgnorePatterns: ["<rootDir>/test/browser/"],
  setupFilesAfterEnv: ["<rootDir>/test/jest.setup.ts"],
  clearMocks: true,
  collectCoverageFrom: [
    "<rootDir>/src/**/*.{ts,tsx}",
    "!<rootDir>/src/**/*.stories.tsx"
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"]
};
