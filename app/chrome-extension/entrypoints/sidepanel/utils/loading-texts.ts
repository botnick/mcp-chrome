/**
 * Random loading text
 * Used in TimelineStatusStep component for fun waiting hints
 */

const loadingTexts = [
  // Classic quips
  'Should have been smooth sailing...',
  'Now it is a mad scramble',
  'I know you are in a hurry, but hang on',
  'Doggy-paddling through the ocean of knowledge',
  'Let the bullet fly a little longer',
  'Hand-crafting your answer',
  'Summoning the little helpers',
  "Don't rush me, already on it (creating new folder)",
  'Sweating bullets while thinking',
  'The CPU is about to catch fire',
  // Everyday vibes
  'Slow-roasting perfection takes time',
  'Flipping the knowledge pancake',
  'Cheers to myself, almost done',
  'Putting inspiration in the oven',
  'Letting the answer steep a bit longer',
  'Maximizing good vibes',
  'Knitting a sweater of words for you',
  // Wild imagination
  'Neurons are dancing',
  'The night-owl is pondering',
  'Coloring in the answer',
  'Frantically flipping through the knowledge base',
  'Brain circus is starting',
  'Mashing 0s and 1s together',
  'Charging up the ultimate move',
  'Magnifying glass is fogging up, wiping it off',
  'Trying to make sense of this wild request',
  // Fantasy
  'Casting a spell, do not disturb',
  'Waking up the silicon friend',
  'Connecting to cyberspace wisdom',
  'Hold on, running calculations',
  'Traversing the knowledge black hole',
  'Reverse-engineering human intent',
  'Crystal ball is a bit foggy, give it a tap',
  // Work mode
  'Code running faster than a reporter',
  'Manager is online, please wait',
  'Rushing over at full speed',
  'Transporting knowledge at light speed',
  'Last piece of the puzzle',
  'Answer is almost ready',
  'Launch countdown',
  'Locking on target',
];

/**
 * Get a random loading text
 */
export function getRandomLoadingText(): string {
  return loadingTexts[Math.floor(Math.random() * loadingTexts.length)];
}
