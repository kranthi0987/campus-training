// Day 14 · ETL (Azure & Databricks), Santoshini: the questions of this trainer's part, picked from the day's combined bank in
// day14-devops-etl.js (numbers as listed there). Edit that file to change a question; edit the list
// here to move one between the day's parts.
import day from './day14-devops-etl.js';

const PICK = [8, 12, 13, 14, 22, 24]; // 1-based numbers in the day file
export default PICK.map((n) => day[n - 1]);
