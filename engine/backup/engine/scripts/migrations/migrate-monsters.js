const fs = require('fs');
const path = require('path');
const { parseString } = require('xml2js');

const MONSTERS_JSON_DIR = path.join(__dirname, '..', '..', 'data', 'monsters', 'definitions');
const MONSTERS_XML_DIR = path.join(__dirname, '..', '..', 'monster', 'monsters');

const IMMUNITY_FIELDS = ['fire', 'energy', 'physical', 'outfit', 'lifedrain', 'paralyze', 'invisible'];

function parseXmlImmunities(immunities) {
  const result = {};
  IMMUNITY_FIELDS.forEach(f => result[f] = false);
  result.earth = false;
  if (!immunities || !immunities.immunity) return result;
  immunities.immunity.forEach(imm => {
    const attrs = imm.$ || {};
    Object.keys(attrs).forEach(key => {
      if (key === 'poison') {
        result.earth = attrs[key] === '1';
      } else if (IMMUNITY_FIELDS.includes(key)) {
        result[key] = attrs[key] === '1';
      }
    });
  });
  return result;
}

function parseXmlFlags(flags) {
  const result = { runonhealth: 0 };
  if (!flags || !flags.flag) return result;
  flags.flag.forEach(flag => {
    const attrs = flag.$ || {};
    Object.keys(attrs).forEach(key => {
      if (key === 'runonhealth') {
        result.runonhealth = parseInt(attrs[key]) || 0;
      }
    });
  });
  return result;
}

async function main() {
  const jsonFiles = fs.readdirSync(MONSTERS_JSON_DIR).filter(f => f.endsWith('.json'));

  let updatedTargetDistance = 0;
  let addedImmunities = 0;
  let addedRunonhealth = 0;
  let fixedSenseInvisible = 0;

  // Build monster name → XML filename map
  const xmlNameMap = new Map();
  fs.readdirSync(MONSTERS_XML_DIR).filter(f => f.endsWith('.xml')).forEach(f => {
    const name = f.replace(/\.xml$/i, '').toLowerCase();
    xmlNameMap.set(name, f);
  });

  for (const file of jsonFiles) {
    const jsonPath = path.join(MONSTERS_JSON_DIR, file);
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    const monsterName = data.creatureStatistics.name.toLowerCase();

    // Find XML by monster name (XML files have spaces, JSON files have underscores)
    let xmlFilename = null;
    for (const [xmlName, xmlFile] of xmlNameMap) {
      if (xmlName === monsterName) {
        xmlFilename = xmlFile;
        break;
      }
    }

    if (!xmlFilename) {
      console.warn(`  ⚠️  No XML found for "${data.creatureStatistics.name}" (${file})`);
      continue;
    }

    const xmlPath = path.join(MONSTERS_XML_DIR, xmlFilename);
    const xmlContent = fs.readFileSync(xmlPath, 'utf8');

    // Parse XML
    const xmlData = await new Promise((resolve, reject) => {
      parseString(xmlContent, { explicitArray: true }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    const monsterXml = xmlData.monster;
    if (!monsterXml) {
      console.warn(`  ⚠️  Invalid XML for ${file}`);
      continue;
    }

    // Parse immunities from XML
    let xmlImms = {};
    if (monsterXml.immunities && monsterXml.immunities[0]) {
      xmlImms = parseXmlImmunities(monsterXml.immunities[0]);
    } else {
      // Set all false
      IMMUNITY_FIELDS.forEach(f => xmlImms[f] = false);
      xmlImms.earth = false;
    }

    // Parse runonhealth from XML
    const xmlFlags = parseXmlFlags(monsterXml.flags ? monsterXml.flags[0] : null);

    // === Apply migrations ===

    let changed = false;

    // 1. Fix targetDistance from boolean to integer
    if (typeof data.flags.targetDistance === 'boolean' || data.flags.targetDistance === true || data.flags.targetDistance === false) {
      data.flags.targetDistance = data.flags.targetDistance === true ? 1 : 1;
      updatedTargetDistance++;
      changed = true;
    }

    // 2. Add immunities if missing
    if (!data.immunities) {
      data.immunities = xmlImms;
      addedImmunities++;
      changed = true;
    }

    // 3. Add runonhealth if missing
    if (data.flags.runonhealth === undefined) {
      data.flags.runonhealth = xmlFlags.runonhealth;
      addedRunonhealth++;
      changed = true;
    }

    // 4. Fix senseInvisible based on immunities.invisible
    if (data.immunities && data.immunities.invisible === true) {
      data.behaviour.senseInvisible = true;
      fixedSenseInvisible++;
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
    }
  }

  console.log('\n✅ Migration complete!');
  console.log(`   targetDistance fixed: ${updatedTargetDistance}`);
  console.log(`   immunities added: ${addedImmunities}`);
  console.log(`   runonhealth added: ${addedRunonhealth}`);
  console.log(`   senseInvisible fixed: ${fixedSenseInvisible}`);
}

main().catch(console.error);
