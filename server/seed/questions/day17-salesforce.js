// Day 17 · Salesforce, Arpitha: the questions of this trainer's part, picked from the day's combined bank in
// day17-domain-erp.js (numbers as listed there). Edit that file to change a question; edit the list
// here to move one between the day's parts.
import day from './day17-domain-erp.js';

const PICK = [1, 2, 3, 13, 14, 18, 23]; // 1-based numbers in the day file
export default PICK.map((n) => day[n - 1]);
