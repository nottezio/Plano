import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/**
 * Deliberately narrow: the rules of hooks, and nothing else.
 *
 * This exists because of one bug, and it is scoped to that bug's class.
 * `useShiftNotes` was called below PatientPage's `if (loading) return` early
 * return — which reads naturally, sits next to the JSX that uses it, passes
 * `tsc` cleanly, passes 702 tests, and crashes every single time a patient is
 * opened. React counts hooks per render; the loading render skipped it and the
 * next render called it.
 *
 * TypeScript cannot see this and the test suite does not render routes, so
 * there was no guardrail at all for the one category of React error that is
 * both invisible statically and fatal at runtime. Now there is.
 *
 * NOT a general lint adoption. Style rules on a codebase this size would
 * produce hundreds of findings, `npm run verify` would go red for reasons
 * unrelated to correctness, and the habit of trusting a green pipeline —
 * which is the thing actually keeping this app safe — would rot. Every rule
 * here must be one that catches a real defect.
 *
 * `exhaustive-deps` is a WARNING, not an error. Several hooks in this codebase
 * omit dependencies on purpose, with comments explaining why; making it fatal
 * would force either noise-suppression comments everywhere or wrong changes to
 * working code.
 */
export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'dev-dist/**', '*.config.js', '*.config.ts'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    // The TypeScript parser, without type-aware linting: `rules-of-hooks` is
    // purely syntactic, and a type-aware pass would add a full program build
    // to every `verify` run for no extra findings.
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
);
