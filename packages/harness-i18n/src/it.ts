// Harness-specific translations and overrides
// Keys here will override any matching keys from upstream translations
export const dict = {
  // Harness Gateway provider translations
  "provider.connect.harnessGateway.byok.prefix": "Per ulteriori statistiche sull'utilizzo, utilizza ",
  "provider.connect.harnessGateway.byok.link": "BYOK tramite Harness's Gateway",
  "provider.connect.harnessGateway.byok.suffix": ".",

  // Provider settings translations
  "settings.providers.group.recommended": "Consigliati",
  "settings.providers.note.harness": "Accesso a oltre 500 modelli AI",
  "settings.providers.note.opencode": "Modelli selezionati, inclusi Claude, GPT, Gemini e altri",
  "settings.providers.note.anthropic": "Accesso diretto ai modelli Claude, inclusi Pro e Max",
  "settings.providers.note.deepseek": "Modelli DeepSeek per attività di ragionamento e programmazione",
  "settings.providers.note.copilot": "Modelli Claude per assistenza alla programmazione",
  "settings.providers.note.openai": "Modelli GPT e Codex con chiave API o accesso ChatGPT",
  "settings.providers.note.google": "Modelli Gemini per risposte rapide e strutturate",
  "settings.providers.note.openrouter": "Accesso a tutti i modelli supportati da un unico provider",
  "settings.providers.note.vercel": "Accesso unificato ai modelli IA con routing intelligente",

  // Reasoning block label
  "ui.reasoning.label": "Ragionamento",

  // Marketplace

  // Plan follow-up question shown after plan_exit
  "plan.followup.header": "Implementa",
  "plan.followup.question": "Pronto per implementare?",
  "plan.followup.answer.newSession": "Avvia una nuova sessione",
  "plan.followup.answer.newSession.description": "Implementa in una nuova sessione con contesto vuoto",
  "plan.followup.answer.continue": "Continua qui",
  "plan.followup.answer.continue.description": "Implementa il piano in questa sessione",
  "plan.followup.answer.keepRefining": "Continua a rifinire",
  "plan.followup.answer.keepRefining.description": "Continua a pianificare senza implementare per ora",

  "snapshot.slowRepo.header": "Snapshot lento",
  "snapshot.slowRepo.question":
    "L'inizializzazione del sistema snapshot sta richiedendo molto tempo, probabilmente a causa delle dimensioni del repository.\n\nVuoi disabilitare gli snapshot per questo repository?",
  "snapshot.slowRepo.answer.continue": "Continua con gli snapshot",
  "snapshot.slowRepo.answer.continue.description":
    "Continua ad attendere il completamento dello snapshot. Le iterazioni successive saranno rapide dopo la creazione dello snapshot iniziale.",
  "snapshot.slowRepo.answer.disable": "Disabilita per questo progetto",
  "snapshot.slowRepo.answer.disable.description":
    "Disattiva gli snapshot di Harness per questo progetto. Perderai annulla/ripeti sulle modifiche ai file fatte da Harness, ma git continuerà a tracciare tutto.",

  "ui.messagePart.openInDiffViewer": "Apri nel visualizzatore diff",
  "ui.messagePart.openInEditor": "Apri nell'editor",

  "ui.message.feedback.helpful": "È stato utile",
  "ui.message.feedback.notHelpful": "Non è stato utile",
  "ui.message.feedback.clearRating": "Cancella valutazione",
}
