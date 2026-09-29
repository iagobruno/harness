import { defineMemory } from 'eve/memory';
import { byPrincipal } from 'eve/memory/scope';
import { fileMemory } from 'eve/memory/file';

export default defineMemory({
  description: 'Remember stable facts and preferences about the caller.',
  provider: fileMemory(),
  scope: byPrincipal,
});
