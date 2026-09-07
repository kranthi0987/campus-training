// Day 12 · SQL (Azure SQL), Dushanth: the questions of this trainer's part, picked from the day's combined bank in
// day12-sql-mongodb.js (numbers as listed there). Edit that file to change a question; edit the list
// here to move one between the day's parts.
import day from './day12-sql-mongodb.js';

const PICK = [1, 2, 5, 7, 9, 10, 11, 12, 18, 19, 20, 23]; // 1-based numbers in the day file
export default PICK.map((n) => day[n - 1]);
