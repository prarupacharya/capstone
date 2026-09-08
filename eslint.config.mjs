export default [
  {
    ignores: ["node_modules/**"],
    languageOptions: {
      globals: { process: "readonly" }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["error", { "args": "none" }],
      "no-unreachable": "error",
      semi: ["error", "always"]
    }
  }
];
