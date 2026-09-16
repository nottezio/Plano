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
 * `exhaustive-deps` is an ERROR, and `npm run lint` runs with
 * `--max-warnings 0`.
 *
 * It was a warning, on the reasoning that several hooks omitted dependencies
 * on purpose. What that produced was six warnings nobody read while every
 * changelog said "lint — clean" — and one of them was a real bug: applying a
 * consultant's format in Salin changed the button, not the text
 * (see CHANGES.md). A warning that does not fail `verify` is not a
 * guardrail; it is a list that grows.
 *
 * The deliberate omissions turned out not to need suppressing. Each one was
 * "depend on a field, not the object" — which is expressed by reading the
 * field into a const BEFORE the hook and using that const inside it. The list
 * is then complete as written. If a hook ever genuinely must omit something,
 * the escape hatch is a line-level
 * `// eslint-disable-next-line react-hooks/exhaustive-deps` with the reason
 * beside it: visible, greppable, and one at a time.
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
      'react-hooks/exhaustive-deps': 'error',
    },
  },
);
