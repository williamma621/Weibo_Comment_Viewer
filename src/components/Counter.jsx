import { useState } from 'react';

export default function Counter(props) {
  // 1. Initialize state
  const [count, setCount] = useState(5);

  // 2. Define the logic
  const increment = () => {
    setCount(count + 1);
  };

  const decrement = () => {
    setCount(count - 1);
  };

  return (
    <div style={ {color:props.color, border: '1px solid #ccc', padding: '20px', borderRadius: '8px' }}>
      <h2>Counter Component</h2>
      <p>Current Count: **{count}**</p>
      
      {/* 3. Attach logic to events */}
      <button onClick={decrement}>- Decrease</button>
      <button onClick={increment} style={{ marginLeft: '10px' }}>+ Increase</button>
    </div>
  );
}