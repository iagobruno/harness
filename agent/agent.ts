import { chatgpt } from 'eve/models/openai';
import { defineAgent } from 'eve';

/**
 * Root agent runtime configuration.
 */
export default defineAgent({
  model: chatgpt('gpt-5.6-luna'),
  reasoning: 'high',
});
