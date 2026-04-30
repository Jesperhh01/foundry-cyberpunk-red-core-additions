import { Constants } from "./constants.js";
import { Utils } from "./utils.js";

const ACTOR_TYPES = new Set(["character", "mook"]);
const MODULE_STATE_KEY = "__diwakoCpredAdditionsAutoDeadStatus";

function getModuleState() {
  globalThis[MODULE_STATE_KEY] ??= { registered: false, inFlight: new Set() };
  return globalThis[MODULE_STATE_KEY];
}

function getDeadStatusId() {
  return CONFIG.specialStatusEffects?.DEFEATED ?? "dead";
}

function shouldBeMarkedDead(actor) {
  const derivedStats = actor?.system?.derivedStats;
  return (
    ACTOR_TYPES.has(actor?.type) &&
    (derivedStats?.hp?.value ?? 1) <= 0 &&
    derivedStats?.currentWoundState === "mortallyWounded"
  );
}

function hasChangedPath(changed, path) {
  if (!changed) return false;
  if (Object.prototype.hasOwnProperty.call(changed, path)) return true;
  if (foundry.utils?.hasProperty) return foundry.utils.hasProperty(changed, path);

  let current = changed;
  for (const part of path.split(".")) {
    if (!current || !Object.prototype.hasOwnProperty.call(current, part)) {
      return false;
    }
    current = current[part];
  }
  return true;
}

function isRelevantActorChange(changed) {
  return (
    hasChangedPath(changed, "system.derivedStats.hp") ||
    hasChangedPath(changed, "system.derivedStats.hp.value") ||
    hasChangedPath(changed, "system.derivedStats.currentWoundState")
  );
}

export class AutoDeadStatus {
  static initialize() {
    const moduleState = getModuleState();
    if (moduleState.registered) return;
    moduleState.registered = true;

    Hooks.on("updateActor", async (actor, changed) => {
      if (!isRelevantActorChange(changed)) return;
      if (!Utils.isResponsibleGM()) return;
      if (!game.settings.get(Constants.MODULE_NAME, "autoDeadStatus")) return;
      if (!shouldBeMarkedDead(actor)) return;

      const deadStatusId = getDeadStatusId();
      if (actor.statuses?.has(deadStatusId)) return;
      const actorKey = actor.uuid ?? actor.id;
      if (moduleState.inFlight.has(actorKey)) return;

      moduleState.inFlight.add(actorKey);
      try {
        await actor.toggleStatusEffect(deadStatusId, { active: true, overlay: true });
      } finally {
        moduleState.inFlight.delete(actorKey);
      }
    });
  }
}
