// Day 14 · DevOps, Ravi Chabria: the questions of this trainer's part, picked from the day's combined bank in
// day14-devops-etl.js (numbers as listed there). Edit that file to change a question; edit the list
// here to move one between the day's parts.
import day from './day14-devops-etl.js';

const PICK = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 15, 16, 17, 18, 19, 20, 21, 23]; // 1-based numbers in the day file
export default PICK.map((n) => day[n - 1]);
