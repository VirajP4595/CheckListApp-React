import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './tests/setupTests.ts',
        coverage: {
            provider: 'v8',
            reporter: ['text-summary', 'html', 'lcov'],
            include: ['src/**/*.{ts,tsx}'],
            exclude: ['node_modules', 'tests', 'src/**/*.d.ts'],
            reportsDirectory: './tests/coverage',
        },
        reporters: ['default'],
    },
    resolve: {
        alias: {
            '@': '/src',
            '@components': '/src/components',
            '@models': '/src/models',
            '@services': '/src/services',
            '@stores': '/src/stores',
        },
    },
});
