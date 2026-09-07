// Day 13 · JavaScript, Kaushik C: the JavaScript half of the day deck (pictures 1–39).
import day from './day13-frontend.js';
import { sliceDeck } from '../parts.js';

export default sliceDeck(day, {
  key: 'day13-javascript',
  title: 'Tech Refresher – JavaScript',
  sections: ['agenda', 'mentors', 'js-basics', 'js-core', 'js-context', 'js-handson', 'js-close'],
});
