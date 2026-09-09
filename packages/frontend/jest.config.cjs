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
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^.+\\.css$": "<rootDir>/test/style-mock.cjs"
  },
  testMatch: ["<rootDir>/test/**/*.spec.ts", "<rootDir>/test/**/*.spec.tsx"],
  testPathIgnorePatterns: ["<rootDir>/test/browser/"],
  setupFilesAfterEnv: ["<rootDir>/test/jest.setup.ts"],
  clearMocks: true,
  collectCoverageFrom: [
    "<rootDir>/src/**/*.{ts,tsx}",
    "!<rootDir>/src/**/*.stories.tsx"
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"]
};
