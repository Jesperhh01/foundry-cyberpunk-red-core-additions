import { Constants } from "./constants.js";

const FEATURE_KEY = "martialArtsAutoweapon";
const SOURCE_MODULE_ID = "cpr-martial-arts-autoweapon";
const FLAG_SOURCE_SKILL = "sourceSkillId";
const FLAG_MANAGED = "moduleManaged";
const FLAG_SPECIAL_MOVE = "specialMoveKey";
const FLAG_FORM = "formKey";
const SUPPORTED_ACTOR_TYPES = new Set(["character", "mook"]);
const FORM_KEYS = ["aikido", "karate", "judo", "taekwondo"];
const FORM_LABELS = { aikido: "Aikido", karate: "Karate", judo: "Judo", taekwondo: "Taekwondo" };
const MARTIAL_ARTS_NAME_RE = /^\s*martial arts(\s|\()/i;
const WEAPON_IMG = "systems/cyberpunk-red-core/icons/compendium/weapons/martial_arts.svg";

const BASE_WEAPON_SYSTEM = Object.freeze({
  ammoVariety: [],
  attackmod: 0,
  brand: "",
  canIgnoreArmor: true,
  concealable: { concealable: true, isConcealed: false },
  critFailEffect: "jammed",
  damage: "1d6",
  description: { value: "<p>Auto-generated martial arts attack. Damage scales with BODY.</p>" },
  dvTable: "",
  equipped: "equipped",
  favorite: false,
  fireModes: { autoFire: 0, suppressiveFire: false },
  handsReq: 1,
  ignoreArmorPercent: 50,
  ignoreBelowSP: 0,
  installedItems: { allowed: false, allowedTypes: ["itemUpgrade"], list: [], slots: 0, usedSlots: 0 },
  isRanged: false,
  magazine: { ammoData: null, max: 0, value: 0 },
  price: { market: 0 },
  quality: "standard",
  revealed: true,
  rof: 2,
  source: { book: "Core", page: 178 },
  unarmedAutomaticCalculation: true,
  usage: "equipped",
  usesType: "magazine",
  weaponType: "martialArts",
});

const SPECIAL_MOVES = [
  { key: "recovery", form: "shared", name: "Martial Arts: Recovery", dv: 13, dealsDamage: false, requirement: "None. All Martial Arts Forms may use this Move.", effect: "When you use the Get Up Action, attempt to beat DV13 with the Martial Arts Special Move Resolution. On success, that Get Up Action did not cost an Action." },
  { key: "disarming-combination", form: "aikido", name: "Aikido: Disarming Combination", dv: 15, dealsDamage: false, requirement: "You hit the same target with a Brawling Attack and a Martial Arts Attack this Turn.", effect: "Once per Turn, attempt to beat DV15. On success, one object held in the target's hands is either in your hands or on the floor." },
  { key: "iron-grip", form: "aikido", name: "Aikido: Iron Grip", dv: 15, dealsDamage: false, requirement: "You have a target successfully Grabbed that isn't already affected by Iron Grip.", effect: "Use an Action to attempt to beat DV15. On success, the target suffers -2 to all future Grapple-escape attempts and cannot make Ranged Attacks until the Grapple is broken." },
  { key: "armor-breaking-combination", form: "karate", name: "Karate: Armor Breaking Combination", dv: 15, dealsDamage: false, requirement: "You hit the same target with a Melee Weapon and a Martial Arts Attack this Turn.", effect: "Once per Turn, attempt to beat DV15. On success, all of the target's worn armor is ablated by an additional 2 points." },
  { key: "bone-breaking-strike", form: "karate", name: "Karate: Bone Breaking Strike", dv: null, dealsDamage: true, criticalInjury: "Broken Ribs", aimedShotCriticalInjury: "Cracked Skull", requirement: "WILL 8 or higher.", effect: "Replaces your 2-attack Martial Arts Action with one attack vs. a single target in Melee range. On hit: deal Martial Arts damage and inflict the Broken Ribs Critical Injury. At -8 to the Check, target the head for Cracked Skull instead." },
  { key: "counter-throw", form: "judo", name: "Judo: Counter Throw", dv: 15, dealsDamage: false, requirement: "You dodged all Melee Attacks targeted at you since your last Turn.", effect: "Use an Action to attempt to beat DV15. On success, use the Throw Action on one melee-range target whose attack you dodged. This Throw cannot be avoided." },
  { key: "grab-escape", form: "judo", name: "Judo: Grab Escape", dv: 15, dealsDamage: false, criticalInjury: "Broken Arm", requirement: "You hit the target grappling you with 2 Melee Attacks this Turn.", effect: "Once per Turn, attempt to beat DV15. On success, you are no longer grappled and the target suffers Broken Arm (your choice of arm)." },
  { key: "pressure-point-strike", form: "taekwondo", name: "Taekwondo: Pressure Point Strike", dv: null, dealsDamage: true, criticalInjury: "Spinal Injury", aimedShotCriticalInjury: "Brain Injury", requirement: "WILL 8 or higher.", effect: "Replaces your 2-attack Martial Arts Action with one attack vs. a single target in Melee range. On hit: deal Martial Arts damage and inflict Spinal Injury. At -8 to the Check, target the head for Brain Injury instead." },
  { key: "flying-kick", form: "taekwondo", name: "Taekwondo: Flying Kick", dv: null, dealsDamage: true, requirement: "MOVE 8 or higher. You must have moved at least 4m/yds already this Turn.", effect: "Replaces your 2-attack Martial Arts Action and uses all remaining movement. Fling in a straight line up to 4m/yds toward a target; on hit, deal Martial Arts damage, leave them Prone, and knock them off open vehicles." },
];

function moduleEnabled() {
  return game.settings.get(Constants.MODULE_NAME, FEATURE_KEY);
}

function shouldProcess(userId) {
  return game.user.id === userId;
}

function parseFormKey(skillName) {
  const match = `${skillName ?? ""}`.match(/Martial Arts\s*\((.+?)\)/i);
  if (!match) return null;
  const style = match[1].trim().toLowerCase();
  return FORM_KEYS.includes(style) ? style : null;
}

function movesForForm(formKey) {
  return SPECIAL_MOVES.filter((move) => move.form === formKey);
}

function sharedMoves() {
  return SPECIAL_MOVES.filter((move) => move.form === "shared");
}

function isMartialArtsSkill(item) {
  if (item?.type !== "skill") return false;
  return item.system?.skillType === "martialArt" || MARTIAL_ARTS_NAME_RE.test(item.name || "");
}

function getMartialArtsSkills(actor) {
  return actor?.itemTypes?.skill?.filter(isMartialArtsSkill) ?? [];
}

function getRawFlag(item, scope, flag) {
  return foundry.utils.getProperty(item?.flags?.[scope] ?? {}, flag);
}

function getCurrentModuleFlag(item, flag) {
  return item.getFlag(Constants.MODULE_NAME, flag);
}

function getLegacyModuleFlag(item, flag) {
  return getRawFlag(item, SOURCE_MODULE_ID, flag);
}

function getManagedFlag(item, flag) {
  return getCurrentModuleFlag(item, flag) ?? getLegacyModuleFlag(item, flag);
}

function getManagedWeapons(actor) {
  return actor?.itemTypes?.weapon?.filter((weapon) => getManagedFlag(weapon, FLAG_MANAGED) === true) ?? [];
}

function getMirroredWeapon(actor, skillId) {
  return actor.items.find((item) => item.type === "weapon" && getManagedFlag(item, FLAG_MANAGED) === true && getManagedFlag(item, FLAG_SPECIAL_MOVE) == null && getManagedFlag(item, FLAG_SOURCE_SKILL) === skillId);
}

function getSpecialMoveItem(actor, moveKey, skillId = null) {
  return actor.items.find((item) => item.type === "weapon" && getManagedFlag(item, FLAG_MANAGED) === true && getManagedFlag(item, FLAG_SPECIAL_MOVE) === moveKey && (skillId === null || getManagedFlag(item, FLAG_SOURCE_SKILL) === skillId));
}

function buildWeaponData(skill) {
  return { name: skill.name, type: "weapon", img: WEAPON_IMG, system: { ...foundry.utils.deepClone(BASE_WEAPON_SYSTEM), weaponSkill: skill.name }, flags: { [Constants.MODULE_NAME]: { [FLAG_MANAGED]: true, [FLAG_SOURCE_SKILL]: skill.id } } };
}

function buildSpecialMoveDescription(move) {
  const parts = [`<p><strong>Requirement:</strong> ${move.requirement}</p>`, `<p><strong>Effect:</strong> ${move.effect}</p>`];
  parts.push(move.dv != null ? `<p><strong>Target:</strong> DV${move.dv} (compare roll total)</p>` : "<p><strong>Target:</strong> Opposed by Defender's DEX + Evasion + 1d10</p>");
  if (move.criticalInjury) parts.push(`<p><strong>Critical Injury on hit:</strong> ${move.criticalInjury}${move.aimedShotCriticalInjury ? ` (or ${move.aimedShotCriticalInjury} with a -8 aimed shot to the head)` : ""}</p>`);
  return parts.join("");
}

function buildSpecialMoveData(move, skill) {
  const system = foundry.utils.deepClone(BASE_WEAPON_SYSTEM);
  system.weaponSkill = skill.name;
  system.rof = 1;
  system.description = { value: buildSpecialMoveDescription(move) };
  if (!move.dealsDamage) {
    system.unarmedAutomaticCalculation = false;
    system.damage = "0d1";
  }
  return { name: move.name, type: "weapon", img: WEAPON_IMG, system, flags: { [Constants.MODULE_NAME]: { [FLAG_MANAGED]: true, [FLAG_SOURCE_SKILL]: skill.id, [FLAG_SPECIAL_MOVE]: move.key, [FLAG_FORM]: move.form } } };
}

async function createMirroredWeapon(actor, skill) {
  if (getMirroredWeapon(actor, skill.id)) return null;
  const [created] = await actor.createEmbeddedDocuments("Item", [buildWeaponData(skill)]);
  return created;
}

async function deleteMirroredWeapon(actor, skillId) {
  const weapon = getMirroredWeapon(actor, skillId);
  if (weapon) await actor.deleteEmbeddedDocuments("Item", [weapon.id]);
}

async function renameMirroredWeapon(actor, skill) {
  const weapon = getMirroredWeapon(actor, skill.id);
  if (weapon && (weapon.name !== skill.name || weapon.system.weaponSkill !== skill.name)) {
    await actor.updateEmbeddedDocuments("Item", [{ _id: weapon.id, name: skill.name, "system.weaponSkill": skill.name }]);
  }
  const updates = getManagedWeapons(actor)
    .filter((weapon) => getManagedFlag(weapon, FLAG_SPECIAL_MOVE) != null && getManagedFlag(weapon, FLAG_SOURCE_SKILL) === skill.id && weapon.system.weaponSkill !== skill.name)
    .map((weapon) => ({ _id: weapon.id, "system.weaponSkill": skill.name }));
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
}

async function grantFormMoves(actor, skill) {
  const formKey = parseFormKey(skill.name);
  if (!formKey) return;
  const toCreate = movesForForm(formKey).filter((move) => !getSpecialMoveItem(actor, move.key, skill.id)).map((move) => buildSpecialMoveData(move, skill));
  if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);
}

async function ensureSharedMoves(actor) {
  const martialSkills = getMartialArtsSkills(actor);
  if (!martialSkills.length) return;
  const anchorSkill = martialSkills[0];
  const toCreate = sharedMoves().filter((move) => !getSpecialMoveItem(actor, move.key)).map((move) => buildSpecialMoveData(move, anchorSkill));
  if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);
}

async function revokeFormMoves(actor, skillId) {
  const moves = getManagedWeapons(actor).filter((weapon) => getManagedFlag(weapon, FLAG_SPECIAL_MOVE) != null && getManagedFlag(weapon, FLAG_FORM) !== "shared" && getManagedFlag(weapon, FLAG_SOURCE_SKILL) === skillId);
  if (moves.length) await actor.deleteEmbeddedDocuments("Item", moves.map((move) => move.id));
}

async function revokeSharedMovesIfOrphaned(actor) {
  if (getMartialArtsSkills(actor).length > 0) return;
  const shared = getManagedWeapons(actor).filter((weapon) => getManagedFlag(weapon, FLAG_FORM) === "shared");
  if (shared.length) await actor.deleteEmbeddedDocuments("Item", shared.map((move) => move.id));
}

async function rebindSharedMovesIfNeeded(actor, removedSkillId) {
  const shared = getManagedWeapons(actor).filter((weapon) => getManagedFlag(weapon, FLAG_FORM) === "shared" && getManagedFlag(weapon, FLAG_SOURCE_SKILL) === removedSkillId);
  if (!shared.length) return;
  const [anchor] = getMartialArtsSkills(actor);
  if (!anchor) return;
  await actor.updateEmbeddedDocuments("Item", shared.map((weapon) => ({ _id: weapon.id, "system.weaponSkill": anchor.name, [`flags.${Constants.MODULE_NAME}.${FLAG_SOURCE_SKILL}`]: anchor.id })));
}

async function reconcileActor(actor) {
  if (!SUPPORTED_ACTOR_TYPES.has(actor?.type)) return;
  await migrateSourceModuleFlags(actor);
  const skills = getMartialArtsSkills(actor);
  const skillIds = new Set(skills.map((skill) => skill.id));
  for (const skill of skills) {
    if (!getMirroredWeapon(actor, skill.id)) await createMirroredWeapon(actor, skill);
    await grantFormMoves(actor, skill);
  }
  await ensureSharedMoves(actor);
  const orphans = getManagedWeapons(actor).filter((weapon) => {
    const sourceId = getManagedFlag(weapon, FLAG_SOURCE_SKILL);
    const formKey = getManagedFlag(weapon, FLAG_FORM);
    return formKey === "shared" ? skills.length === 0 : !skillIds.has(sourceId);
  });
  if (orphans.length) await actor.deleteEmbeddedDocuments("Item", orphans.map((weapon) => weapon.id));
}

function buildMigrationUpdate(weapon) {
  const update = { _id: weapon.id, [`flags.${Constants.MODULE_NAME}.${FLAG_MANAGED}`]: true };
  const sourceSkillId = getLegacyModuleFlag(weapon, FLAG_SOURCE_SKILL);
  const specialMoveKey = getLegacyModuleFlag(weapon, FLAG_SPECIAL_MOVE);
  const formKey = getLegacyModuleFlag(weapon, FLAG_FORM);
  if (sourceSkillId !== undefined) update[`flags.${Constants.MODULE_NAME}.${FLAG_SOURCE_SKILL}`] = sourceSkillId;
  if (specialMoveKey !== undefined) update[`flags.${Constants.MODULE_NAME}.${FLAG_SPECIAL_MOVE}`] = specialMoveKey;
  if (formKey !== undefined) update[`flags.${Constants.MODULE_NAME}.${FLAG_FORM}`] = formKey;
  return update;
}

async function migrateSourceModuleFlags(actor) {
  const updates = getManagedWeapons(actor)
    .filter((weapon) => getCurrentModuleFlag(weapon, FLAG_MANAGED) !== true && getLegacyModuleFlag(weapon, FLAG_MANAGED) === true)
    .map(buildMigrationUpdate);
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
}

export class MartialArtsAutoweapon {
  static initialize() {
    Hooks.on("createItem", async (item, _options, userId) => {
      if (!moduleEnabled() || !shouldProcess(userId) || !isMartialArtsSkill(item)) return;
      const actor = item.parent;
      if (!actor || !SUPPORTED_ACTOR_TYPES.has(actor.type)) return;
      await createMirroredWeapon(actor, item);
      await grantFormMoves(actor, item);
      await ensureSharedMoves(actor);
    });

    Hooks.on("deleteItem", async (item, _options, userId) => {
      if (!moduleEnabled() || !shouldProcess(userId) || !isMartialArtsSkill(item)) return;
      const actor = item.parent;
      if (!actor || !SUPPORTED_ACTOR_TYPES.has(actor.type)) return;
      await deleteMirroredWeapon(actor, item.id);
      await revokeFormMoves(actor, item.id);
      await rebindSharedMovesIfNeeded(actor, item.id);
      await revokeSharedMovesIfOrphaned(actor);
    });

    Hooks.on("updateItem", async (item, changes, _options, userId) => {
      if (!moduleEnabled() || !shouldProcess(userId) || !isMartialArtsSkill(item)) return;
      const actor = item.parent;
      if (!actor || !SUPPORTED_ACTOR_TYPES.has(actor.type) || changes.name === undefined) return;
      await renameMirroredWeapon(actor, item);
    });

    Hooks.once("ready", async () => {
      game.modules.get(Constants.MODULE_NAME).api ??= { funcs: {} };
      game.modules.get(Constants.MODULE_NAME).api.martialArtsAutoweapon = { reconcileActor, reconcileAll: async () => { for (const actor of game.actors) await reconcileActor(actor); }, SPECIAL_MOVES };
      if (!moduleEnabled() || !game.user.isGM) return;
      for (const actor of game.actors) await reconcileActor(actor);
    });

  }
}
