// Short "pop" played when a chat message arrives. Uses expo-audio (npx expo install expo-audio).
// The library is loaded only if it exists, so a missing package never crashes the app.
let player: any = null;
let isAudioConfigured = false;

export async function playChatSound() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExpoAudio = require("expo-audio");

    // Configure audio mode once so sounds play reliably across platforms
    if (!isAudioConfigured && ExpoAudio.setAudioModeAsync) {
      isAudioConfigured = true;
      ExpoAudio.setAudioModeAsync({
        playsInSilentMode: true,
      }).catch(() => {});
    }

    if (!player) {
      player = ExpoAudio.createAudioPlayer(
        require("../../assets/sounds/chat_pop.wav")
      );
    }

    // Reset playback position if it has played before
    if (player.currentTime > 0) {
      await player.seekTo(0);
    }

    await player.play();
  } catch (e) {
    console.log("Chat sound not played:", (e as any)?.message);
  }
}