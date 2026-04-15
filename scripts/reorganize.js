import fs from 'fs';
import path from 'path';

const sourceDir = '/vercel/share/v0-project/oji-ai-gate-main';
const targetDir = '/vercel/share/v0-project';

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const files = fs.readdirSync(src);

  files.forEach((file) => {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);

    if (fs.lstatSync(srcPath).isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied: ${destPath}`);
    }
  });
}

try {
  copyRecursive(sourceDir, targetDir);
  
  // Remove the source directory
  function removeDirectory(dir) {
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach((file) => {
        const curPath = path.join(dir, file);
        if (fs.lstatSync(curPath).isDirectory()) {
          removeDirectory(curPath);
        } else {
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(dir);
      console.log(`Removed directory: ${dir}`);
    }
  }
  
  removeDirectory(sourceDir);
  console.log('Reorganization complete!');
} catch (error) {
  console.error('Error during reorganization:', error);
  process.exit(1);
}
