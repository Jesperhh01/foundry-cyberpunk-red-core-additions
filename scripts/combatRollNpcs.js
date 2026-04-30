const MODULE_STATE_KEY = "__diwakoCpredAdditionsCombatRollNpcs";
const CPR_NPC_ACTOR_TYPES = new Set(["mook", "demon", "blackIce"]);

function getModuleState() {
  globalThis[MODULE_STATE_KEY] ??= { registered: false };
  return globalThis[MODULE_STATE_KEY];
}

function getCombatantActor(combatant) {
  return combatant?.actor ?? combatant?.token?.actor ?? null;
}

function isCprNpcCombatant(combatant) {
  const actor = getCombatantActor(combatant);
  return CPR_NPC_ACTOR_TYPES.has(actor?.type);
}

export class CombatRollNpcs {
  static initialize() {
    const moduleState = getModuleState();
    if (moduleState.registered) return;
    moduleState.registered = true;

    const originalRollNpc = Combat.prototype.rollNPC;
    Combat.prototype.rollNPC = function rollCprNpcInitiative(options = {}) {
      if (game.system.id !== "cyberpunk-red-core") {
        return originalRollNpc.call(this, options);
      }

      const ids = this.combatants.reduce((combatantIds, combatant) => {
        if (
          combatant.isOwner &&
          combatant.initiative === null &&
          isCprNpcCombatant(combatant)
        ) {
          combatantIds.push(combatant.id);
        }
        return combatantIds;
      }, []);

      return this.rollInitiative(ids, options);
    };
  }
}
