import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

const vitestGlobals = {
    afterAll: "readonly",
    afterEach: "readonly",
    beforeAll: "readonly",
    beforeEach: "readonly",
    describe: "readonly",
    expect: "readonly",
    it: "readonly",
    vi: "readonly",
};

export default [
    { ignores: ["dist", "coverage", "node_modules"] },
    {
        ...js.configs.recommended,
        files: ["**/*.{js,jsx}"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        plugins: {
            "react-hooks": reactHooks,
            "react-refresh": reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
        },
    },
    {
        files: ["src/test/**/*.{js,jsx}"],
        languageOptions: {
            globals: vitestGlobals,
        },
    },
];
