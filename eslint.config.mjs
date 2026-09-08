import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["node_modules/**", "storybook-static/**", "**/storybook-static/**"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" }
    },
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { "args": "none" }],
      semi: ["error", "always"]
    }
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: {
        URL: "readonly",
        Response: "readonly",
        console: "readonly",
        fetch: "readonly",
        process: "readonly"
      }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["error", { "args": "none" }],
      "no-unreachable": "error",
      semi: ["error", "always"]
    }
  }
];
