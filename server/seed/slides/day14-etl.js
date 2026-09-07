// Day 14 · ETL, Santoshini: the Azure ETL deck (pictures 57–71). Opens with its own title slides.
import day from './day14-devops-etl.js';
import { sliceDeck } from '../parts.js';

export default sliceDeck(day, {
  key: 'day14-etl',
  title: "The Fresher's Guide to Azure ETL",
  sections: ['etl-intro', 'etl-core', 'etl-e2e', 'etl-recap'],
  agenda: false,
});
