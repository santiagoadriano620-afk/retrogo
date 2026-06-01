const fs = require('fs-extra');
const path = require('path');
const CleanCSS = require('clean-css');

const CLIENT_DIR = path.join(__dirname, '../../client');
const SRC_DIR = path.join(CLIENT_DIR, 'src');
const DIST_DIR = path.join(CLIENT_DIR, 'dist');

async function build() {
    console.log('Starting client build...');
    await fs.emptyDir(DIST_DIR);
    console.log('Cleaned dist directory.');

    const launcherPath = path.join(SRC_DIR, 'launcher.js');
    const launcherContent = await fs.readFile(launcherPath, 'utf8');

    const scriptsMatch = launcherContent.match(/const SCRIPTS = \[\s*([\s\S]*?)\];/);
    if (!scriptsMatch) throw new Error('Could not find SCRIPTS array in launcher.js');

    const scriptPaths = scriptsMatch[1]
        .split(',')
        .map(s => s.trim().replace(/['"]/g, ''))
        .filter(s => s.length > 0)
        .map(s => path.join(CLIENT_DIR, s));

    console.log(`Found ${scriptPaths.length} scripts to bundle.`);

    let bundledCode = '';
    for (const scriptPath of scriptPaths) {
        if (await fs.pathExists(scriptPath)) {
            bundledCode += `\n// START ${path.basename(scriptPath)}\n${await fs.readFile(scriptPath, 'utf8')}\n// END ${path.basename(scriptPath)}\n`;
        } else {
            console.warn(`Warning: Script not found: ${scriptPath}`);
        }
    }

    await fs.writeFile(path.join(DIST_DIR, 'game.js'), bundledCode);
    console.log('Written game.js');

    const newLauncherContent = launcherContent.replace(/const SCRIPTS = \[\s*[\s\S]*?\];/, 'const SCRIPTS = [];');
    await fs.writeFile(path.join(DIST_DIR, 'launcher.js'), newLauncherContent);
    console.log('Written launcher.js');

    for (const dir of ['css', 'data', 'images', 'sounds', 'fonts']) {
        const src = path.join(CLIENT_DIR, dir);
        if (await fs.pathExists(src)) await fs.copy(src, path.join(DIST_DIR, dir));
    }
    const defs = path.join(CLIENT_DIR, 'definitions.json');
    if (await fs.pathExists(defs)) await fs.copy(defs, path.join(DIST_DIR, 'definitions.json'));

    let indexHtml = await fs.readFile(path.join(CLIENT_DIR, 'index.html'), 'utf8');
    let cssContent = '';
    const linkRegEx = /<link rel="stylesheet" type="text\/css" href="\.\/css\/([^"]+)">/g;
    let match;
    while ((match = linkRegEx.exec(indexHtml)) !== null) {
        const cssPath = path.join(CLIENT_DIR, 'css', match[1]);
        if (await fs.pathExists(cssPath)) cssContent += await fs.readFile(cssPath, 'utf8');
    }
    if (cssContent) {
        const cssOutput = new CleanCSS({ rebase: false }).minify(cssContent);
        await fs.mkdirp(path.join(DIST_DIR, 'css'));
        await fs.writeFile(path.join(DIST_DIR, 'css', 'style.css'), cssOutput.styles);
        console.log('Written style.css');
    }

    indexHtml = indexHtml.replace(
        '<script src="src/launcher.js"></script>',
        '<script src="game.js"></script>\n  <script src="launcher.js"></script>'
    );
    indexHtml = indexHtml.replace(/<link rel="stylesheet" type="text\/css" href="\.\/css\/[^"]+">\s*/g, '');
    indexHtml = indexHtml.replace('</head>', '  <link rel="stylesheet" type="text/css" href="css/style.css">\n</head>');
    await fs.writeFile(path.join(DIST_DIR, 'index.html'), indexHtml);
    console.log('Written index.html');

    console.log('Build complete!');
}

build().catch(console.error);
