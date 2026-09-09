/** @type {import("jest").Config} */
module.exports = {
  rootDir: ".",
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }]
  },
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/**/*.spec.ts"],
  clearMocks: true,
  collectCoverageFrom: ["<rootDir>/src/**/*.ts"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"]
};
