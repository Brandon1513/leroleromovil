// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // ...cualquier otro plugin que tengas
      'react-native-reanimated/plugin', // <-- SIEMPRE AL FINAL
    ],
  };
};
