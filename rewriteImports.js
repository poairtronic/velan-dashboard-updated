const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory() && !file.includes('node_modules') && !file.includes('server')) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('calculationUtils')) {
    let replaced = false;
    content = content.replace(/import\s+\{\s*([^}]+)\s*\}\s+from\s+['"](.*?)calculationUtils(\.js)?['"];?/g, (match, p1, p2) => {
      replaced = true;
      return `import calculationUtils from '${p2}calculationUtils';\nconst { ${p1} } = calculationUtils;`;
    });
    if (replaced) {
      fs.writeFileSync(file, content);
      console.log('Updated ' + file);
    }
  }
});
