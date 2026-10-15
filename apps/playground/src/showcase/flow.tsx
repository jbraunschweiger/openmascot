/** The Echo app flow: sections, their screens, and the order focus mode walks them in. */
import type { ComponentType } from 'react';
import { ChooseInstrument, ExperienceLevel, FirstNote, FirstSuccess, MicSetup, Welcome } from './screens/onboarding';
import { LearnPath, LessonStart } from './screens/learn';
import { Detecting, LessonComplete, LessonProgress, NextPrompt, SuccessFeedback } from './screens/lesson';
import { Practice, Profile, SongPlayback } from './screens/app';

export interface ScreenDef {
  id: string;
  /** Caption under the phone (also the focus-mode title). */
  caption: string;
  /** Hide the caption in the overview (the mock has none for sections 2 & 3). */
  hideCaption?: boolean;
  /** Screen width / height, measured from the reference mock. */
  aspect: number;
  dark?: boolean;
  /** One line on what Echo does here (focus mode). */
  echo: string;
  C: ComponentType;
}

export interface SectionDef {
  id: string;
  num: number;
  title: string;
  sub: string;
  /** Relative width in the overview row (from the mock). */
  grow: number;
  screens: ScreenDef[];
}

const ONB = 150 / 357;
export const SECTIONS: SectionDef[][] = [
  [
    {
      id: 'onboarding',
      num: 1,
      title: 'Onboarding flow',
      sub: 'Get to your first note in under 1 minute',
      grow: 1010,
      screens: [
        { id: 'welcome', caption: '1. Welcome', aspect: ONB, dark: true, C: Welcome, echo: 'Flies in and greets you; “Let’s go” sends Echo off with a burst of notes.' },
        { id: 'instrument', caption: '2. Choose instrument', aspect: ONB, C: ChooseInstrument, echo: 'Nods at Guitar, shakes its head at the “coming soon” instruments.' },
        { id: 'experience', caption: '3. Experience level', aspect: ONB, C: ExperienceLevel, echo: 'Reacts differently to each level — hearts for brand-new players.' },
        { id: 'mic', caption: '4. Microphone setup', aspect: ONB, C: MicSetup, echo: 'Listens until audio is detected, then nods with a check.' },
        { id: 'first-note', caption: '5. First note', aspect: ONB, C: FirstNote, echo: 'Hangs around while you pluck — tap the string or the ring to play the E.' },
        { id: 'first-success', caption: '6. First success', aspect: ONB, dark: true, C: FirstSuccess, echo: 'Celebrates with confetti. Tap Echo to cheer again.' },
      ],
    },
    {
      id: 'learn',
      num: 2,
      title: 'Learn path',
      sub: 'Your musical journey',
      grow: 250,
      screens: [{ id: 'learn-path', caption: 'Learn path', hideCaption: true, aspect: 227 / 415, C: LearnPath, echo: 'Hangs from a tree; tap lessons, locked nodes and the chest to see Echo react.' }],
    },
    {
      id: 'lesson-start',
      num: 3,
      title: 'Lesson start',
      sub: 'Context and goal',
      grow: 225,
      screens: [{ id: 'lesson-start', caption: 'Lesson start', hideCaption: true, aspect: 210 / 409, C: LessonStart, echo: 'Press Listen: Echo listens, then confirms the G chord.' }],
    },
  ],
  [
    {
      id: 'during',
      num: 4,
      title: 'During the lesson',
      sub: 'Real-time feedback',
      grow: 590,
      screens: [
        { id: 'detecting', caption: 'Detecting correct notes', aspect: 136 / 335, C: Detecting, echo: 'Listens as each note lands; tap the fretboard to strum again.' },
        { id: 'success-feedback', caption: 'Success feedback', aspect: 136 / 335, C: SuccessFeedback, echo: 'A happy bounce and a check when the chord rings true.' },
        { id: 'next-prompt', caption: 'Next prompt', aspect: 136 / 335, C: NextPrompt, echo: 'Points at the next chord. Tap the fretboard to play C.' },
        { id: 'progress', caption: 'Progress within lesson', aspect: 136 / 335, C: LessonProgress, echo: 'Encourages you; tap the steps to finish the lesson.' },
      ],
    },
    {
      id: 'complete',
      num: 5,
      title: 'Lesson complete',
      sub: 'Reward and insight',
      grow: 255,
      screens: [{ id: 'complete', caption: 'Results and next action', aspect: 233 / 333, dark: true, C: LessonComplete, echo: 'Full celebration with confetti.' }],
    },
    {
      id: 'song',
      num: 6,
      title: 'Song playback',
      sub: 'Apply your skills',
      grow: 230,
      screens: [{ id: 'song', caption: 'Song with backing track', aspect: 223 / 333, C: SongPlayback, echo: 'Dances to the backing track; pause and Echo stops.' }],
    },
    {
      id: 'practice',
      num: 7,
      title: 'Practice',
      sub: 'Target weak areas',
      grow: 202,
      screens: [{ id: 'practice', caption: 'Personalized practice', aspect: 199 / 333, C: Practice, echo: 'Peeks up and gets excited when you start a drill.' }],
    },
    {
      id: 'profile',
      num: 8,
      title: 'Profile',
      sub: 'See your progress',
      grow: 205,
      screens: [{ id: 'profile', caption: 'Progress, stats, and achievements', aspect: 196 / 333, C: Profile, echo: 'Tap the streak card (or Echo) for a victory dance.' }],
    },
  ],
];

export const ALL_SECTIONS = SECTIONS.flat();
export const FLOW = ALL_SECTIONS.flatMap((s) => s.screens.map((screen) => ({ ...screen, section: s })));
export type FlowScreen = (typeof FLOW)[number];
