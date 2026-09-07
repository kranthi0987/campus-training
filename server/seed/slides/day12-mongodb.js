// Day 12 · MongoDB, Vishnu C: the MongoDB half of the day deck (pictures 32–71). Its first slides are its own title, agenda and trainer slides, so no agenda slide is added.
import day from './day12-sql-mongodb.js';
import { sliceDeck } from '../parts.js';

export default sliceDeck(day, {
  key: 'day12-mongodb',
  title: 'MongoDB',
  sections: ['mongo-intro', 'mongo-basics', 'mongo-crud', 'mongo-query', 'mongo-agg', 'mongo-practice', 'mongo-quiz', 'mongo-close'],
  agenda: false,
});
