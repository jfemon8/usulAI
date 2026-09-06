import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", "public/widget.js", "node_modules/**"],
  },
  {
    files: ["src/app/**/{icon,apple-icon,opengraph-image,twitter-image}.tsx"],
    rules: { "@next/next/no-img-element": "off" },
  },
];

export default eslintConfig;
