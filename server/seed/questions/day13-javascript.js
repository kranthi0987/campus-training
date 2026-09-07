// Day 13 · JavaScript, Kaushik C: the questions of this trainer's part, picked from the day's combined bank in
// day13-frontend.js (numbers as listed there). Edit that file to change a question; edit the list
// here to move one between the day's parts.
import day from './day13-frontend.js';

const PICK = [4, 5, 11, 12, 15, 17, 22, 23]; // 1-based numbers in the day file
export default PICK.map((n) => day[n - 1]);
