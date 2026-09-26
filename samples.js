const SAMPLE_FILES = {
  "Bass drum": "samples/bass-drum.flac",
  "Snare": "samples/snare-louder.wav",
  "Cowbell": "samples/cowbell.wav",
  "Side stick": "samples/side-stick.flac",
  "Agogo": "samples/agogo.wav",
  "Tambourine": "samples/tambourine.wav",
  "Hi-hat": "samples/hi-hat.flac",
  "Hey": "samples/hey.mp3"
};
const SAMPLE_PLAYBACK_RATES = {Snare: 2 ** (2 / 12)};
// Keep the approved A/B gain; normalizing the edited snare would undo its boost.
const SAMPLE_FIXED_GAINS = {Snare: .75 / .761871337890625};
const SAMPLE_CUTS = {Hey: {duration: .18, attack: .004, release: .018}};
