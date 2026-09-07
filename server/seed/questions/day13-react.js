// Day 13 · HTML, CSS & React, Prakash: the questions of this trainer's part, picked from the day's combined bank in
// day13-frontend.js (numbers as listed there). Edit that file to change a question; edit the list
// here to move one between the day's parts.
import day from './day13-frontend.js';

const PICK = [1, 2, 3, 6, 7, 8, 9, 10, 13, 14, 16, 18, 19, 20, 21, 24]; // 1-based numbers in the day file
export default PICK.map((n) => day[n - 1]);
