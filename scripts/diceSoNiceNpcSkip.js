import { Constants } from "./constants.js";

const MODULE_STATE_KEY = "__diwakoCpredAdditionsDiceSoNiceNpcSkip";
const NPC_ACTOR_TYPES = new Set(["mook", "demon", "blackIce"]);

function getModuleState() {
  globalThis[MODULE_STATE_KEY] ??= {
    currentCprRoll: null,
    cprRollPatched: false,
    cprRollPatchPromise: null,
    dice3dPatched: false,
    chatHookRegistered: false,
  };
  return globalThis[MODULE_STATE_KEY];
}

function getSetting(key) {
  try {
    return game.settings.get(Constants.MODULE_NAME, key);
  } catch (_error) {
    return false;
  }
}

function setHiddenProperty(target, key, value) {
  if (!target) return;
  Object.defineProperty(target, key, {
    configurable: true,
    writable: true,
    value,
  });
}

function isNpcActor(actor) {
  if (!actor) return false;
  if (NPC_ACTOR_TYPES.has(actor.type)) return true;
  return actor.hasPlayerOwner === false && actor.type !== "character";
}

function resolveActorFromEntityData(entityData) {
  if (!entityData) return null;
  const tokenId = entityData.token ?? entityData.tokenId;
  const actorId = entityData.actor ?? entityData.actorId;
  if (tokenId && game.actors.tokens?.[tokenId]) {
    return game.actors.tokens[tokenId];
  }
  return game.actors.get(actorId) ?? null;
}

function resolveActorFromSpeaker(speaker) {
  if (!speaker) return null;
  if (typeof ChatMessage.getSpeakerActor === "function") {
    const actor = ChatMessage.getSpeakerActor(speaker);
    if (actor) return actor;
  }
  if (speaker.token && game.actors.tokens?.[speaker.token]) {
    return game.actors.tokens[speaker.token];
  }
  return game.actors.get(speaker.actor) ?? null;
}

function resolveActorFromCprRoll(cprRoll) {
  return (
    cprRoll?.__diwakoCpredAdditionsDsnActor ??
    resolveActorFromEntityData(cprRoll?.entityData) ??
    cprRoll?.combatant?.actor ??
    cprRoll?.combatant?.token?.actor ??
    null
  );
}

function annotateFoundryRoll(foundryRoll, cprRoll) {
  if (!foundryRoll || !cprRoll) return;
  const actor = resolveActorFromCprRoll(cprRoll);
  setHiddenProperty(foundryRoll, "__diwakoCpredAdditionsDsn", {
    actor,
    actorId: actor?.id ?? cprRoll.entityData?.actor ?? null,
    tokenId: cprRoll.entityData?.token ?? cprRoll.combatant?.token?.id ?? null,
    initiative: cprRoll.constructor?.name === "CPRInitiative",
  });
}

function shouldSkipDsn(actor, isInitiative) {
  if (!isNpcActor(actor)) return false;
  if (getSetting("skipNpcDiceSoNice")) return true;
  return isInitiative && getSetting("skipNpcInitiativeDiceSoNice");
}

function shouldSkipMessage(message) {
  const actor = resolveActorFromSpeaker(message?.speaker);
  const isInitiative = message?.flags?.core?.initiativeRoll === true;
  return shouldSkipDsn(actor, isInitiative);
}

function shouldSkipFoundryRoll(foundryRoll, speaker) {
  const metadata = foundryRoll?.__diwakoCpredAdditionsDsn;
  const cprRoll = getModuleState().currentCprRoll;
  const actor =
    metadata?.actor ??
    resolveActorFromEntityData(metadata) ??
    resolveActorFromSpeaker(speaker) ??
    resolveActorFromCprRoll(cprRoll);
  const isInitiative =
    metadata?.initiative === true || cprRoll?.constructor?.name === "CPRInitiative";
  return shouldSkipDsn(actor, isInitiative);
}

function registerChatMessageSkip() {
  const moduleState = getModuleState();
  if (moduleState.chatHookRegistered) return;
  moduleState.chatHookRegistered = true;

  Hooks.on("diceSoNiceMessagePreProcess", (messageId, interception) => {
    const message = game.messages.get(messageId);
    if (!message?.isRoll) return;
    if (shouldSkipMessage(message)) interception.willTrigger3DRoll = false;
  });
}

function patchDice3d() {
  const moduleState = getModuleState();
  if (moduleState.dice3dPatched || !game.dice3d?.showForRoll) return;
  moduleState.dice3dPatched = true;

  const originalShowForRoll = game.dice3d.showForRoll;
  game.dice3d.showForRoll = async function showForRollWithNpcSkip(...args) {
    const [roll, , , , , , speaker] = args;
    if (shouldSkipFoundryRoll(roll, speaker)) return false;
    return originalShowForRoll.apply(this, args);
  };
}

function rememberRollActor(cprRoll, actor) {
  if (!cprRoll || !actor) return cprRoll;
  setHiddenProperty(cprRoll, "__diwakoCpredAdditionsDsnActor", actor);
  if (!cprRoll.entityData) {
    cprRoll.entityData = { actor: actor.id, token: actor.token?.id ?? null };
  }
  annotateFoundryRoll(cprRoll._roll, cprRoll);
  annotateFoundryRoll(cprRoll._critRoll, cprRoll);
  return cprRoll;
}

function patchRollFactory(prototype, actorResolver) {
  if (!prototype || prototype.__diwakoCpredAdditionsDsnCreateRollPatched) return;
  const originalCreateRoll = prototype.createRoll;
  if (typeof originalCreateRoll !== "function") return;

  setHiddenProperty(prototype, "__diwakoCpredAdditionsDsnCreateRollPatched", true);
  prototype.createRoll = function createRollWithDsnActor(...args) {
    const cprRoll = originalCreateRoll.apply(this, args);
    return rememberRollActor(cprRoll, actorResolver.call(this, args));
  };
}

async function patchCprRolls() {
  const moduleState = getModuleState();
  if (moduleState.cprRollPatched) return;
  if (moduleState.cprRollPatchPromise) return moduleState.cprRollPatchPromise;

  moduleState.cprRollPatchPromise = (async () => {
    const CPRRolls = await import("/systems/cyberpunk-red-core/modules/rolls/cpr-rolls.js");
    const CPRActorModule = await import("/systems/cyberpunk-red-core/modules/actor/cpr-actor.js");
    const CPRItemModule = await import("/systems/cyberpunk-red-core/modules/item/cpr-item.js");
    const CPRRoll = CPRRolls.CPRRoll;
    if (!CPRRoll?.prototype) return;

    moduleState.cprRollPatched = true;
    if (!Object.getOwnPropertyDescriptor(CPRRoll.prototype, "entityData")) {
      Object.defineProperty(CPRRoll.prototype, "entityData", {
        configurable: true,
        get() {
          return this.__diwakoCpredAdditionsEntityData;
        },
        set(value) {
          setHiddenProperty(this, "__diwakoCpredAdditionsEntityData", value);
          annotateFoundryRoll(this._roll, this);
          annotateFoundryRoll(this._critRoll, this);
        },
      });
    }

    const originalHandleRollDialog = CPRRoll.prototype.handleRollDialog;
    if (typeof originalHandleRollDialog === "function") {
      CPRRoll.prototype.handleRollDialog = function handleRollDialogWithDsnActor(
        event,
        actor,
        item
      ) {
        setHiddenProperty(this, "__diwakoCpredAdditionsDsnActor", actor);
        return originalHandleRollDialog.call(this, event, actor, item);
      };
    }

    const originalRoll = CPRRoll.prototype.roll;
    if (typeof originalRoll === "function") {
      CPRRoll.prototype.roll = async function rollWithDsnContext(...args) {
        const previousRoll = moduleState.currentCprRoll;
        moduleState.currentCprRoll = this;
        try {
          const result = await originalRoll.apply(this, args);
          annotateFoundryRoll(this._roll, this);
          annotateFoundryRoll(this._critRoll, this);
          return result;
        } finally {
          moduleState.currentCprRoll = previousRoll;
        }
      };
    }

    patchRollFactory(CPRActorModule.default?.prototype, function resolveActorRollActor() {
      return this;
    });
    patchRollFactory(CPRItemModule.default?.prototype, function resolveItemRollActor(args) {
      return args[1];
    });
  })();

  try {
    await moduleState.cprRollPatchPromise;
  } catch (error) {
    moduleState.cprRollPatchPromise = null;
    console.warn("diwako-cpred-additions | Could not patch CPR rolls for Dice So Nice NPC skipping", error);
  }
}

export class DiceSoNiceNpcSkip {
  static initialize() {
    patchCprRolls();
    Hooks.once("ready", () => {
      registerChatMessageSkip();
      patchDice3d();
      Hooks.once("diceSoNiceReady", patchDice3d);
    });
  }
}
