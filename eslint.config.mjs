import next from "eslint-config-next";

// eslint-config-next@16 ships a native flat-config array (core-web-vitals +
// typescript), so we spread it directly — no FlatCompat bridge needed.
const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "backups/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },
  ...next,
];

export default eslintConfig;
