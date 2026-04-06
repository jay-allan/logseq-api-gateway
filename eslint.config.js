// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettierPlugin = require('eslint-plugin-prettier/recommended');

module.exports = tseslint.config(
    {
        ignores: ['src/**/*.test.ts', 'dist/**', 'docs/**', 'scripts/**']
    },
    eslint.configs.recommended,
    tseslint.configs.recommended,
    prettierPlugin
);
