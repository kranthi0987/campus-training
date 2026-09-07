// Day 18 · Enterprise Integration, Kranthi Kumar: the questions of this trainer's part, picked from the day's combined bank in
// day18-integration-ai.js (numbers as listed there). Edit that file to change a question; edit the list
// here to move one between the day's parts.
import day from './day18-integration-ai.js';

const PICK = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 20, 21, 22, 23, 24, 26]; // 1-based numbers in the day file
export default PICK.map((n) => day[n - 1]);
