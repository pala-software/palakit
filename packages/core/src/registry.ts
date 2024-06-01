export const createRegistry = <T, Arguments extends unknown[]>(
  transform: (...args: Arguments) => T
) => {
  const registry: T[] = [];
  return {
    registry,
    register: (...args: Arguments) => {
      const toRegister = transform(...args);
      registry.push(toRegister);
      return toRegister;
    },
  };
};
