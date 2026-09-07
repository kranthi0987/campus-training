// Day 12 · MongoDB, Vishnu C: the questions of this trainer's part, picked from the day's combined bank in
// day12-sql-mongodb.js (numbers as listed there). Edit that file to change a question; edit the list
// here to move one between the day's parts.
import day from './day12-sql-mongodb.js';

const PICK = [3, 4, 6, 8, 13, 14, 15, 16, 17, 21, 22, 24]; // 1-based numbers in the day file
export default PICK.map((n) => day[n - 1]);
