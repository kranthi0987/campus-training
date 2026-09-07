// Day 17 · Supply Chain, Savitha: the questions of this trainer's part, picked from the day's combined bank in
// day17-domain-erp.js (numbers as listed there). Edit that file to change a question; edit the list
// here to move one between the day's parts.
import day from './day17-domain-erp.js';

const PICK = [4, 5, 6, 7, 8, 11, 12, 15, 16, 17, 19, 20, 22, 24]; // 1-based numbers in the day file
export default PICK.map((n) => day[n - 1]);
