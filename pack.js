// This script generates Firefox version of the extension and packs Chrome and Firefox versions to zip files.

const fsp = require('fs').promises;
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const args = process.argv.slice(2);

async function copyDir(src, dest) {
    const entries = await fsp.readdir(src, { withFileTypes: true });
    await fsp.mkdir(dest);
    for (let entry of entries) {
        if(entry.name === '.git' || entry.name === '.github' || entry.name === '_metadata' || entry.name === 'node_modules') continue;
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            await copyDir(srcPath, destPath);
        } else {
            await fsp.copyFile(srcPath, destPath);
        }
    }
}

if(fs.existsSync('../RetroXLayoutTempChrome')) {
  fs.rmSync('../RetroXLayoutTempChrome', { recursive: true });
}
if(fs.existsSync('../RetroXLayoutFirefox')) {
  fs.rmSync('../RetroXLayoutFirefox', { recursive: true });
}

console.log("Copying...");
copyDir('./', '../RetroXLayoutFirefox').then(async () => {
    await copyDir('./', '../RetroXLayoutTempChrome');
    console.log("Copied!");
    console.log("Patching...");
    let manifest = JSON.parse(fs.readFileSync('../RetroXLayoutFirefox/manifest.json', 'utf8'));
    manifest.manifest_version = 2;
    manifest.background.scripts = ['scripts/background.js'];
    manifest.web_accessible_resources = manifest.web_accessible_resources[0].resources;
    manifest.permissions = manifest.permissions.filter(p => p !== 'declarativeNetRequest' && p !== 'contextMenus' && p !== 'scripting');
    manifest.browser_specific_settings = {
        "gecko": {
            "strict_min_version": "78.0"
        },
        "gecko_android": {
            "strict_min_version": "78.0"
        }
    }
    manifest.permissions = [
        ...manifest.permissions,
        ...manifest.host_permissions,
        "https://dimden.dev/*",
        "https://raw.githubusercontent.com/*",
        "webRequest",
        "webRequestBlocking"
    ];
    delete manifest.host_permissions;
    delete manifest.declarative_net_request;
    delete manifest.background.service_worker;
    delete manifest.action;
    manifest.content_scripts = [
        {
          "matches": ["https://twitter.com/*?*newtwitter=true*"],
          "js": ["scripts/newtwitter.js"],
          "all_frames": true,
          "run_at": "document_end"
        },
        {
          "matches": ["https://twitter.com/*"],
          "exclude_matches": ["https://twitter.com/*?*newtwitter=true*", "https://twitter.com/settings/download_your_data", "https://twitter.com/i/flow/login*", "https://twitter.com/i/tweetdeck", "https://twitter.com/i/communitynotes", "https://twitter.com/i/broadcasts/*"],
          "js": ["scripts/blockBeforeInject.js", "scripts/config.js", "scripts/helpers.js", "scripts/apis.js", "scripts/injection.js", "libraries/twemoji.min.js", "libraries/custom-elements.min.js", "libraries/emojipicker.js", "libraries/twitter-text.js"],
          "all_frames": true,
          "run_at": "document_start"
        },
        {
          "matches": ["https://twitter.com/*"],
          "exclude_matches": ["https://twitter.com/*?*newtwitter=true*", "https://twitter.com/settings/download_your_data", "https://twitter.com/i/flow/login*", "https://twitter.com/i/tweetdeck", "https://twitter.com/i/communitynotes", "https://twitter.com/i/broadcasts/*"],
          "js": ["layouts/header/script.js", "scripts/tweetviewer.js", "libraries/gif.js", "libraries/viewer.min.js", "libraries/tinytoast.js"],
          "css": ["libraries/viewer.min.css"],
          "all_frames": true,
          "run_at": "document_idle"
        },
        {
          "matches": ["https://twitter.com/home", "https://twitter.com/home?*", "https://twitter.com/", "https://twitter.com/?*", "https://twitter.com/home/", "https://twitter.com/home/?*"],
          "js": ["layouts/home/script.js", "libraries/iframeNavigation.js"],
          "all_frames": true,
          "run_at": "document_idle"
        },
        {
          "matches": [
            "https://twitter.com/notifications", "https://twitter.com/notifications/", "https://twitter.com/notifications?*", "https://twitter.com/notifications/?*", 
            "https://twitter.com/notifications/mentions", "https://twitter.com/notifications/mentions?*", "https://twitter.com/notifications/mentions/", "https://twitter.com/notifications/mentions/?*"
          ],
          "js": ["layouts/notifications/script.js"],
          "all_frames": true,
          "run_at": "document_idle"
        },
        {
          "matches": ["https://twitter.com/old/settings", "https://twitter.com/old/settings/", "https://twitter.com/old/settings?*", "https://twitter.com/old/settings/?*"],
          "js": ["libraries/parseCssColor.js", "libraries/coloris.min.js", "layouts/settings/script.js", "libraries/viewer.min.js"],
          "all_frames": true,
          "run_at": "document_idle"
        },
        {
          "matches": ["https://twitter.com/search", "https://twitter.com/search?*", "https://twitter.com/search/", "https://twitter.com/search/?*"],
          "js": ["layouts/search/script.js"],
          "run_at": "document_idle",
          "all_frames": true
        },
        {
          "matches": [
            "https://twitter.com/*/status/*", "https://twitter.com/*/status/*?*", "https://twitter.com/*/status/*/", "https://twitter.com/*/status/*/?*",
            "https://twitter.com/*/status/*/likes", "https://twitter.com/*/status/*/likes/", "https://twitter.com/*/status/*/likes?*", "https://twitter.com/*/status/*/likes/?*",
            "https://twitter.com/*/status/*/retweets", "https://twitter.com/*/status/*/retweets/", "https://twitter.com/*/status/*/retweets?*", "https://twitter.com/*/status/*/retweets/?*",
            "https://twitter.com/*/status/*/retweets/with_comments", "https://twitter.com/*/status/*/retweets/with_comments/", "https://twitter.com/*/status/*/retweets/with_comments?*", "https://twitter.com/*/status/*/retweets/with_comments/?*"
          ],
          "js": ["layouts/tweet/script.js"],
          "run_at": "document_idle",
          "all_frames": true
        },
        {
          "matches": [
            "https://twitter.com/i/lists/*", "https://twitter.com/i/lists/*/", "https://twitter.com/i/lists/*?*", "https://twitter.com/i/lists/*/?*",
            "https://twitter.com/i/lists/*/members", "https://twitter.com/i/lists/*/members/", "https://twitter.com/i/lists/*/members?*", "https://twitter.com/i/lists/*/members/?*",
            "https://twitter.com/i/lists/*/followers", "https://twitter.com/i/lists/*/followers/", "https://twitter.com/i/lists/*/followers?*", "https://twitter.com/i/lists/*/followers/?*"
          ],
          "js": ["layouts/lists/script.js"],
          "all_frames": true,
          "run_at": "document_idle"
        },
        {
          "matches": ["https://twitter.com/i/bookmarks", "https://twitter.com/i/bookmarks/", "https://twitter.com/i/bookmarks?*", "https://twitter.com/i/bookmarks/?*"],
          "js": ["layouts/bookmarks/script.js"],
          "all_frames": true,
          "run_at": "document_idle"
        },
        {
          "matches": ["https://twitter.com/i/topics/*", "https://twitter.com/i/topics/*/", "https://twitter.com/i/topics/*?*", "https://twitter.com/i/topics/*/?*"],
          "js": ["layouts/topics/script.js"],
          "all_frames": true,
          "run_at": "document_idle"
        },
        {
          "matches": ["https://twitter.com/old/history", "https://twitter.com/old/history/", "https://twitter.com/old/history?*", "https://twitter.com/old/history/?*"],
          "js": ["layouts/history/script.js"],
          "all_frames": true,
          "run_at": "document_idle"
        },
        {
          "matches": ["https://twitter.com/old/unfollows/*", "https://twitter.com/old/unfollows/*/", "https://twitter.com/old/unfollows/*?*", "https://twitter.com/old/unfollows/*/?*"],
          "js": ["layouts/unfollows/script.js"],
          "all_frames": true,
          "run_at": "document_idle"
        },
        {
          "matches": ["https://twitter.com/i/timeline", "https://twitter.com/i/timeline?*", "https://twitter.com/i/timeline/", "https://twitter.com/i/timeline/?*"],
          "js": ["layouts/itl/script.js"],
          "all_frames": true,
          "run_at": "document_idle"
        },
        {
          "matches": ["https://twitter.com/*", "https://twitter.com/*/", "https://twitter.com/*/with_replies", "https://twitter.com/*/with_replies/", "https://twitter.com/*/media", "https://twitter.com/*/likes", "https://twitter.com/*/following", "https://twitter.com/*/followers", "https://twitter.com/*/followers_you_follow", "https://twitter.com/*/followers_you_follow/", "https://twitter.com/*/media/", "https://twitter.com/*/likes/", "https://twitter.com/*/following/", "https://twitter.com/*/followers/"],
          "exclude_matches": [
            "https://twitter.com/",
            "https://twitter.com/home",
            "https://twitter.com/notifications",
            "https://twitter.com/notifications/",
            "https://twitter.com/messages",
            "https://twitter.com/messages/",
            "https://twitter.com/settings",
            "https://twitter.com/settings/",
            "https://twitter.com/explore",
            "https://twitter.com/explore/",
            "https://twitter.com/old/*",
            "https://twitter.com/login",
            "https://twitter.com/login/",
            "https://twitter.com/register",
            "https://twitter.com/register/",
            "https://twitter.com/signin",
            "https://twitter.com/signin/",
            "https://twitter.com/signup",
            "https://twitter.com/signup/",
            "https://twitter.com/logout",
            "https://twitter.com/logout/",
            "https://twitter.com/i/*",
            "https://twitter.com/*/status/*",
            "https://twitter.com/*/status/*/",
            "https://twitter.com/search?*",
            "https://twitter.com/search",
            "https://twitter.com/search/",
            "https://twitter.com/search/?*",
            "https://twitter.com/tos",
            "https://twitter.com/privacy",
            "https://twitter.com/*/tos",
            "https://twitter.com/*/privacy"
          ],
          "js": ["layouts/profile/script.js"],
          "run_at": "document_idle",
          "all_frames": true
        }
    ];

    let config = fs.readFileSync('../RetroXLayoutFirefox/scripts/config.js', 'utf8');
    config = config.replace(/chrome\.storage\.sync\./g, "chrome.storage.local.");
    let helpers = fs.readFileSync('../RetroXLayoutFirefox/scripts/helpers.js', 'utf8');
    helpers = helpers.replace(/chrome\.storage\.sync\./g, "chrome.storage.local.");
    let tweetviewer = fs.readFileSync('../RetroXLayoutFirefox/scripts/tweetviewer.js', 'utf8');
    tweetviewer = tweetviewer.replace(/chrome\.storage\.sync\./g, "chrome.storage.local.");
    let content = fs.readFileSync('../RetroXLayoutFirefox/scripts/injection.js', 'utf8');
    content = content.replace(/chrome.runtime.sendMessage\(\{.+?\}\)/gs, "");
    content = content.replace(/chrome\.storage\.sync\./g, "chrome.storage.local.");

    let apis = fs.readFileSync('../RetroXLayoutFirefox/scripts/apis.js', 'utf8');
    apis = apis.replace(/chrome\.storage\.sync\./g, "chrome.storage.local.");
    if(apis.includes("&& true") || apis.includes("&& false") || apis.includes("|| true") || apis.includes("|| false") || apis.includes("&&true") || apis.includes("&&false") || apis.includes("||true") || apis.includes("||false")) {
      if(args[0] === '-a') {
        let line = apis.split("\n").findIndex(l => l.includes("&& true") || l.includes("&& false") || l.includes("|| true") || l.includes("|| false") || l.includes("&&true") || l.includes("&&false") || l.includes("||true") || l.includes("||false"));
        console.warn("::warning file=scripts/api.js,line=" + (line+1) + "::Probably temporary boolean left in code.");
      } else {
        for(let i = 0; i < 5; i++) {
          console.warn("\x1b[33m", "Warning: probably temporary boolean left in code.", '\x1b[0m');
        }
      }
    }
    if(args[0] !== '-a') {
      try {
        require('node-fetch')('https://twitter.com/manifest.json').then(res => res.text()).then(json => {
          if(json.includes("content_security_policy")) {
            for(let i = 0; i < 5; i++) {
              console.warn("\x1b[33m", "Warning: Twitter returned CSP in manifest.json!!!!", '\x1b[0m');
            }
          }
        });
      } catch(e) {}
    }

    let background = fs.readFileSync('../RetroXLayoutFirefox/scripts/background_v2.js', 'utf8');
    
    fs.writeFileSync('../RetroXLayoutFirefox/manifest.json', JSON.stringify(manifest, null, 2));
    fs.writeFileSync('../RetroXLayoutFirefox/scripts/injection.js', content);
    fs.writeFileSync('../RetroXLayoutFirefox/scripts/helpers.js', helpers);
    fs.writeFileSync('../RetroXLayoutFirefox/scripts/tweetviewer.js', tweetviewer);
    fs.writeFileSync('../RetroXLayoutFirefox/scripts/config.js', config);
    fs.writeFileSync('../RetroXLayoutFirefox/scripts/background.js', background);
    fs.writeFileSync('../RetroXLayoutFirefox/scripts/apis.js', apis);
    fs.unlinkSync('../RetroXLayoutFirefox/ruleset.json');
    fs.unlinkSync('../RetroXLayoutFirefox/pack.js');
    fs.unlinkSync('../RetroXLayoutTempChrome/pack.js');
    fs.unlinkSync('../RetroXLayoutTempChrome/scripts/background_v2.js');
    fs.unlinkSync('../RetroXLayoutFirefox/scripts/background_v2.js');
    fs.unlinkSync('../RetroXLayoutFirefox/.gitignore');
    fs.unlinkSync('../RetroXLayoutTempChrome/.gitignore');
    fs.unlinkSync('../RetroXLayoutFirefox/test.js');
    fs.unlinkSync('../RetroXLayoutTempChrome/test.js');
    fs.unlinkSync('../RetroXLayoutFirefox/package.json');
    fs.unlinkSync('../RetroXLayoutTempChrome/package.json');
  
    if (fs.existsSync('../RetroXLayoutFirefox/package-lock.json')) // Delete NPM package-lock (if exists)
      fs.unlinkSync('../RetroXLayoutFirefox/package-lock.json');
    if (fs.existsSync('../RetroXLayoutTempChrome/package-lock.json'))
      fs.unlinkSync('../RetroXLayoutTempChrome/package-lock.json');
  
    if (fs.existsSync('../RetroXLayoutFirefox/yarn.lock')) // Delete yarn package-lock (if exists)
      fs.unlinkSync('../RetroXLayoutFirefox/yarn.lock');
    if (fs.existsSync('../RetroXLayoutTempChrome/yarn.lock'))
      fs.unlinkSync('../RetroXLayoutTempChrome/yarn.lock');

    let layouts = fs.readdirSync('../RetroXLayoutFirefox/layouts');
    for (let layout of layouts) {
        let script = fs.readFileSync(`../RetroXLayoutFirefox/layouts/${layout}/script.js`, 'utf8');
        script = script.replace(/chrome\.storage\.sync\./g, "chrome.storage.local.");
        script = script.replace("https://chrome.google.com/webstore/detail/old-twitter-layout-2022/jgejdcdoeeabklepnkdbglgccjpdgpmf", "https://addons.mozilla.org/en-US/firefox/addon/old-twitter-layout-2022/");
        fs.writeFileSync(`../RetroXLayoutFirefox/layouts/${layout}/script.js`, script);

        let style = fs.readFileSync(`../RetroXLayoutFirefox/layouts/${layout}/style.css`, 'utf8');
        style = style.replaceAll("chrome-extension://", "moz-extension://");
        fs.writeFileSync(`../RetroXLayoutFirefox/layouts/${layout}/style.css`, style);

        let html = fs.readFileSync(`../RetroXLayoutFirefox/layouts/${layout}/index.html`, 'utf8');
        html = html.replaceAll("chrome-extension://", "moz-extension://");
        fs.writeFileSync(`../RetroXLayoutFirefox/layouts/${layout}/index.html`, html);
    }

    console.log("Patched!");
    if (fs.existsSync('../RetroXLayoutFirefox.zip')) {
        console.log("Deleting old zip...");
        fs.unlinkSync('../RetroXLayoutFirefox.zip');
        console.log("Deleted old zip!");
    }
    console.log("Zipping Firefox version...");
    try {
        const zip = new AdmZip();
        const outputDir = "../RetroXLayoutFirefox.zip";
        zip.addLocalFolder("../RetroXLayoutFirefox");
        zip.writeZip(outputDir);
    } catch (e) {
        console.log(`Something went wrong ${e}`);
    }
    console.log(`Zipped Firefox version into ${path.resolve('../RetroXLayoutFirefox.zip')}!`);
    console.log("Zipping Chrome version...");
    try {
        const zip = new AdmZip();
        const outputDir = "../RetroXLayoutChrome.zip";
        zip.addLocalFolder("../RetroXLayoutTempChrome");
        zip.writeZip(outputDir);
    } catch (e) {
        console.log(`Something went wrong ${e}`);
    }
    console.log(`Zipped Chrome version into ${path.resolve('../RetroXLayoutChrome.zip')}!`);
    console.log("Deleting temporary folders...");
    fs.rmSync('../RetroXLayoutTempChrome', { recursive: true });
    fs.rmSync('../RetroXLayoutFirefox', { recursive: true });
    console.log("Deleted!");
});