// Day 18 · Enterprise Integration, Kranthi Kumar: trainer intro, the big picture, REST, SOAP, Apigee, Kafka, OAuth/JWT and a wrap-up (text deck with animated diagrams).
import day from './day18-integration-ai.js';
import { sliceDeck } from '../parts.js';

export default sliceDeck(day, {
  key: 'day18-integration',
  title: 'Enterprise Integration',
  sections: ['about', 'big-picture', 'rest', 'soap', 'apigee', 'kafka', 'oauth-jwt', 'wrap'],
  agendaNote: 'Walk the agenda top to bottom and say what the interns will be able to do by the end: call and design a REST API, read a SOAP contract, explain what the gateway protects, follow an event through Kafka, and validate a token.',
});
