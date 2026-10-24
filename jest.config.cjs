module.exports = {
  projects: [
    {
      displayName: 'server',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/server/**/__tests__/**/*.test.js'],
    },
    {
      displayName: 'client',
      extensionsToTreatAsEsm: ['.jsx'],
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/src/**/__tests__/**/*.test.js'],
      setupFilesAfterEnv: ['@testing-library/jest-dom'],
    },
  ],
  collectCoverageFrom: ['server/**/*.js', 'src/**/*.{js,jsx}', '!**/__tests__/**', '!src/main.jsx'],
};
