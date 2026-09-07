// Day 18 · AI Assistance, Tharun Kumar: the questions of this trainer's part, picked from the day's combined bank in
// day18-integration-ai.js (numbers as listed there). Edit that file to change a question; edit the list
// here to move one between the day's parts.
import day from './day18-integration-ai.js';

const PICK = [6, 17, 18, 19, 25]; // 1-based numbers in the day file
export default PICK.map((n) => day[n - 1]);
