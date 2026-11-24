// Shared "is the streamer live?" flag for anti-raid and presence. Updated by features/live.js.
const state = { twitch: false, kick: false };
const any = () => state.twitch || state.kick;
module.exports = { state, any };
