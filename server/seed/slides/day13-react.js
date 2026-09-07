// Day 13 · HTML, CSS & React, Prakash: the Frontend/UI half of the day deck (pictures 40–72). Opens with its own title and roadmap slides.
import day from './day13-frontend.js';
import { sliceDeck } from '../parts.js';

export default sliceDeck(day, {
  key: 'day13-react',
  title: 'Tech Refresher – Frontend/UI',
  sections: ['ui-intro', 'html', 'css', 'typescript', 'react', 'ecosystem', 'build'],
  agenda: false,
});
