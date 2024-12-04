import typescript from 'rollup-plugin-typescript2';
import copy from 'rollup-plugin-copy';

const DEST_PATH = 'dist';

export default {
  input: {
    popup: 'src/popup.ts',
    background: 'src/background.ts'
  },
  output: {
    dir: DEST_PATH,
    format: 'esm',
  },
  plugins: [
    typescript(),
    copy({
        targets: [
          { src: 'public/*', dest: DEST_PATH },
          { src: 'LICENSE', dest: DEST_PATH },
        ]
    }),
  ]
};