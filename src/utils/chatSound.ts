// Short "pop" played when a chat message arrives. Uses expo-audio (npx expo install expo-audio).
// The library is loaded only if it exists, so a missing package never crashes the app.
let player: any = null;

export function playChatSound() {
  try {
    if (!player) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createAudioPlayer } = require("expo-audio");
         player = createAudioPlayer(require("../../assets/sounds/chat_pop.wav"));
    }
    player.seekTo(0);
    player.play();
  } catch (e) {
    console.log("Chat sound not played:", (e as any)?.message);
  }
}