import typescript from 'rollup-plugin-typescript2';
import copy from 'rollup-plugin-copy';

const DEST_PATH = 'dist';

export default [
  // Конфигурация для popup (ESM, code-splitting)
  {
    input: {
      popup: 'src/popup.ts',
    },
    output: {
      dir: DEST_PATH,
      format: 'esm',
      entryFileNames: '[name].js',
    },
    plugins: [
      typescript(),
      copy({
        targets: [
          { src: 'public/*', dest: DEST_PATH },
          { src: 'LICENSE', dest: DEST_PATH },
        ],
      }),
    ],
  },
  // Конфигурация для background (IIFE, один файл)
  {
    input: 'src/background.ts',
    output: {
      file: `${DEST_PATH}/background.js`,
      format: 'iife',
      name: 'BackgroundScript',
    },
    plugins: [typescript()],
  },
];
