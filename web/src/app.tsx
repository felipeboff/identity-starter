import { useState } from "preact/hooks";

export const App = () => {
  const [count, setCount] = useState(0);

  return (
    <main>
      <h1>Olá, mundo!</h1>
      <button onClick={() => setCount(count + 1)}>Contador: {count}</button>
    </main>
  );
};
