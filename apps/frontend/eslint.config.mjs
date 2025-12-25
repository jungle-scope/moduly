import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import prettier from 'eslint-config-prettier'; // Prettier 충돌 방지

export default tseslint.config(
  // 1. 검사 제외 대상
  {
    ignores: ['dist', 'node_modules', 'build'],
  },

  // 2. JS/TS 공통 권장 설정 적용
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // 3. 메인 설정
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      react,
    },
    rules: {
      // React Hooks: 필수 (배열 의존성 등 체크)
      ...reactHooks.configs.recommended.rules,

      // React: 최신 방식에서는 import React가 불필요하므로 끔
      'react/react-in-jsx-scope': 'off',

      // 개발 편의를 위해 'any'와 'console' 허용 (선택 사항)
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'warn',

      // Fast Refresh: Vite 환경에서 필수
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
    settings: {
      react: { version: 'detect' },
    },
  },

  // 4. Prettier 설정 (가장 마지막에 두어 규칙 충돌 해결)
  prettier,
);
