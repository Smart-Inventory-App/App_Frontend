module.exports = {
  extends: 'expo',
  ignorePatterns: ['/dist/*', '/node_modules/*'],
  overrides: [
    {
      files: ['**/__tests__/**', '**/*.test.*', 'jest.setup.js'],
      env: { jest: true },
    },
  ],
};
