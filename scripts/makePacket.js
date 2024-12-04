import fs from 'fs';
import archiver from 'archiver';

const output = fs.createWriteStream('dist/extension.zip');
const archive = archiver('zip');

output.on('close', () => {
  console.log(`Archieve is ready: ${archive.pointer()} bytes`);
});

archive.pipe(output);
archive.directory('dist/', false);
archive.finalize();