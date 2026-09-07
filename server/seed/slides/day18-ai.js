// Day 18 · AI Assistance, Tharun Kumar: GitHub Copilot, Gemini and prompt engineering (text deck with diagrams).
import day from './day18-integration-ai.js';
import { sliceDeck } from '../parts.js';

export default sliceDeck(day, {
  key: 'day18-ai',
  title: 'AI Assistance',
  sections: ['github-copilot', 'gemini', 'prompt-engineering'],
  agendaNote: 'Walk the agenda top to bottom and say what the interns will be able to do by the end: use Copilot and Gemini as assistants, write prompts that get useful answers, and check what the tools produce instead of trusting them blindly.',
});
